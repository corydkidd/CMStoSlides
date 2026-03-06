"""
Document Sets Worker — PDF extraction, chunking, embedding pipeline.

Polls processing_queue for pending jobs, extracts text from PDFs using
pymupdf, converts to markdown, chunks by section headers and token count,
generates embeddings via OpenAI text-embedding-3-large, and stores in pgvector.
"""

import os
import re
import time
import logging
import uuid
from typing import Optional
from datetime import datetime, timezone

import fitz  # pymupdf
import psycopg2
import psycopg2.extras
import tiktoken
from openai import OpenAI

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger(__name__)

DATABASE_URL = os.environ["DATABASE_URL"]
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
UPLOADS_DIR = "/app/uploads"
EMBEDDING_MODEL = "text-embedding-3-large"
EMBEDDING_DIM = 3072
CHUNK_TARGET_TOKENS = 1000    # target tokens per chunk (800-1200 range)
CHUNK_MAX_TOKENS = 1200
CHUNK_OVERLAP_TOKENS = 100
EMBED_BATCH_SIZE = 100
POLL_INTERVAL_SECONDS = 10

openai_client = OpenAI(api_key=OPENAI_API_KEY)
tokenizer = tiktoken.get_encoding("cl100k_base")


def get_db():
    return psycopg2.connect(DATABASE_URL)


def count_tokens(text: str) -> int:
    return len(tokenizer.encode(text))


def clean_text(text: str) -> str:
    """Fix common PDF extraction artifacts."""
    # Fix hyphenated line breaks
    text = re.sub(r"-\n(\w)", r"\1", text)
    # Normalize multiple blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Remove form feed characters
    text = text.replace("\f", "\n\n")
    # Strip trailing whitespace on lines
    text = "\n".join(line.rstrip() for line in text.split("\n"))
    return text.strip()


def extract_markdown(pdf_path: str) -> str:
    """
    Extract text from PDF using pymupdf, converting heading structure to markdown.
    Returns markdown string.
    """
    doc = fitz.open(pdf_path)
    lines = []

    for page_num, page in enumerate(doc):
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
        for block in blocks:
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                spans = line.get("spans", [])
                if not spans:
                    continue
                text = " ".join(s["text"] for s in spans).strip()
                if not text:
                    continue

                # Heuristic: detect headings by font size
                font_sizes = [s["size"] for s in spans if s.get("size")]
                avg_size = sum(font_sizes) / len(font_sizes) if font_sizes else 10
                flags = spans[0].get("flags", 0) if spans else 0
                is_bold = bool(flags & 2**4)

                if avg_size >= 16 or (avg_size >= 14 and is_bold):
                    lines.append(f"## {text}")
                elif avg_size >= 12 and is_bold:
                    lines.append(f"### {text}")
                else:
                    lines.append(text)

    doc.close()
    raw = "\n".join(lines)
    return clean_text(raw)


def parse_section_path(heading: str) -> Optional[str]:
    """
    Extract section path from a heading like '## II.A.3.b Some Title'.
    Returns the path component (e.g. 'II.A.3.b') or None.
    """
    match = re.match(r"^#{1,6}\s+([IVXivxA-Z0-9]+(?:[.][IVXivxA-Z0-9]+)+)\b", heading)
    if match:
        return match.group(1)
    return None


def chunk_markdown(markdown: str) -> list[dict]:
    """
    Split markdown into chunks by section headers, then sub-chunk large sections
    by paragraph boundaries targeting CHUNK_TARGET_TOKENS with CHUNK_OVERLAP_TOKENS overlap.

    Returns list of dicts: {content, section_path, section_title, chunk_index, token_count}
    """
    # Split on section headers (##, ###, ####, etc.)
    header_pattern = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
    parts = header_pattern.split(markdown)

    sections = []
    # parts = [pre_text, level1, title1, body1, level2, title2, body2, ...]
    # Index 0: text before first header
    if parts[0].strip():
        sections.append({"heading": None, "body": parts[0].strip()})

    i = 1
    while i < len(parts) - 2:
        heading_marker = parts[i]      # e.g. "##"
        heading_text = parts[i + 1].strip()
        body = parts[i + 2].strip()
        full_heading = f"{heading_marker} {heading_text}"
        sections.append({"heading": full_heading, "body": body})
        i += 3

    chunks = []
    chunk_index = 0

    for section in sections:
        heading = section["heading"]
        body = section["body"]
        section_path = parse_section_path(heading) if heading else None
        section_title = None
        if heading:
            # Strip the # prefix and section path to get just the title
            title_match = re.match(r"^#{1,6}\s+(?:[IVXivxA-Z0-9]+(?:[.][IVXivxA-Z0-9]+)+\s+)?(.+)$", heading)
            section_title = title_match.group(1).strip() if title_match else heading.lstrip("#").strip()

        if not body:
            continue

        # Prepend heading to body for context
        full_text = f"{heading}\n\n{body}" if heading else body
        token_count = count_tokens(full_text)

        if token_count <= CHUNK_MAX_TOKENS:
            # Fits in one chunk
            chunks.append({
                "content": full_text,
                "section_path": section_path,
                "section_title": section_title,
                "chunk_index": chunk_index,
                "token_count": token_count,
            })
            chunk_index += 1
        else:
            # Sub-chunk by paragraphs
            paragraphs = re.split(r"\n\n+", body)
            current_parts = [heading] if heading else []
            current_tokens = count_tokens(heading + "\n\n") if heading else 0
            overlap_buffer = []

            for para in paragraphs:
                para = para.strip()
                if not para:
                    continue
                para_tokens = count_tokens(para)

                if current_tokens + para_tokens > CHUNK_MAX_TOKENS and current_parts:
                    # Emit current chunk
                    content = "\n\n".join(current_parts)
                    chunks.append({
                        "content": content,
                        "section_path": section_path,
                        "section_title": section_title,
                        "chunk_index": chunk_index,
                        "token_count": count_tokens(content),
                    })
                    chunk_index += 1

                    # Start next chunk with overlap: last ~CHUNK_OVERLAP_TOKENS of previous
                    overlap_text = content[-CHUNK_OVERLAP_TOKENS * 4:]  # rough char estimate
                    current_parts = [heading, overlap_text, para] if heading else [overlap_text, para]
                    current_tokens = count_tokens("\n\n".join(current_parts))
                else:
                    current_parts.append(para)
                    current_tokens += para_tokens

            if current_parts:
                content = "\n\n".join(current_parts)
                if content.strip():
                    chunks.append({
                        "content": content,
                        "section_path": section_path,
                        "section_title": section_title,
                        "chunk_index": chunk_index,
                        "token_count": count_tokens(content),
                    })
                    chunk_index += 1

    return chunks


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings in batches, returning list of embedding vectors."""
    all_embeddings = []
    for i in range(0, len(texts), EMBED_BATCH_SIZE):
        batch = texts[i:i + EMBED_BATCH_SIZE]
        log.info(f"  Embedding batch {i // EMBED_BATCH_SIZE + 1} ({len(batch)} chunks)...")

        retries = 0
        while retries < 5:
            try:
                response = openai_client.embeddings.create(
                    model=EMBEDDING_MODEL,
                    input=batch,
                )
                batch_embeddings = [item.embedding for item in response.data]
                all_embeddings.extend(batch_embeddings)
                break
            except Exception as e:
                retries += 1
                wait = 2 ** retries
                log.warning(f"  Embedding API error (retry {retries}): {e}. Waiting {wait}s...")
                time.sleep(wait)
        else:
            raise RuntimeError(f"Failed to generate embeddings after 5 retries")

    return all_embeddings


def process_document(job_id: str, document_id: str) -> None:
    """Full pipeline: extract → chunk → embed → store."""
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Mark job started
            now = datetime.now(timezone.utc)
            cur.execute(
                "UPDATE processing_queue SET started_at = %s WHERE id = %s",
                (now, job_id)
            )
            # Update document status
            cur.execute(
                "UPDATE documents SET status = 'processing' WHERE id = %s",
                (document_id,)
            )
            conn.commit()

            # Fetch document info
            cur.execute(
                "SELECT id, document_set_id, title, file_path FROM documents WHERE id = %s",
                (document_id,)
            )
            doc = cur.fetchone()
            if not doc:
                raise RuntimeError(f"Document {document_id} not found")

            file_path = doc["file_path"]
            full_path = os.path.join(UPLOADS_DIR, file_path) if not os.path.isabs(file_path) else file_path

            log.info(f"Processing document: {doc['title']} ({full_path})")

            # Step 1: Extract markdown from PDF
            log.info("  Extracting text from PDF...")
            markdown = extract_markdown(full_path)
            word_count = len(markdown.split())
            log.info(f"  Extracted {word_count} words")

            # Step 2: Chunk
            log.info("  Chunking...")
            chunks = chunk_markdown(markdown)
            log.info(f"  Created {len(chunks)} chunks")

            # Step 3: Generate embeddings
            log.info("  Generating embeddings...")
            texts = [c["content"] for c in chunks]
            embeddings = generate_embeddings(texts)

            # Step 4: Delete existing chunks (for re-index)
            cur.execute("DELETE FROM document_chunks WHERE document_id = %s", (document_id,))
            conn.commit()

            # Step 5: Insert chunks + embeddings
            log.info("  Inserting chunks into DB...")
            for chunk, embedding in zip(chunks, embeddings):
                embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
                cur.execute(
                    """
                    INSERT INTO document_chunks
                      (document_id, document_set_id, chunk_index, content,
                       section_path, section_title, token_count, embedding)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s::vector)
                    """,
                    (
                        document_id,
                        doc["document_set_id"],
                        chunk["chunk_index"],
                        chunk["content"],
                        chunk.get("section_path"),
                        chunk.get("section_title"),
                        chunk["token_count"],
                        embedding_str,
                    )
                )
            conn.commit()

            # Step 6: Update document status → ready
            processed_at = datetime.now(timezone.utc)
            cur.execute(
                """
                UPDATE documents
                SET status = 'ready', word_count = %s, processed_at = %s, status_message = NULL
                WHERE id = %s
                """,
                (word_count, processed_at, document_id)
            )
            # Mark queue job complete
            cur.execute(
                "UPDATE processing_queue SET completed_at = %s WHERE id = %s",
                (processed_at, job_id)
            )
            conn.commit()

            log.info(f"  Done! {len(chunks)} chunks indexed, {word_count} words.")

    except Exception as e:
        log.error(f"Error processing document {document_id}: {e}")
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE documents SET status = 'error', status_message = %s WHERE id = %s",
                    (str(e), document_id)
                )
                cur.execute(
                    "UPDATE processing_queue SET completed_at = now(), error = %s WHERE id = %s",
                    (str(e), job_id)
                )
                conn.commit()
        except Exception as inner:
            log.error(f"Failed to update error status: {inner}")
        raise
    finally:
        conn.close()


def poll_queue() -> None:
    """Poll processing_queue for pending jobs and process them."""
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Claim next pending job (skip already-started jobs)
            cur.execute(
                """
                SELECT pq.id as job_id, pq.document_id
                FROM processing_queue pq
                WHERE pq.started_at IS NULL
                  AND pq.completed_at IS NULL
                ORDER BY pq.queued_at ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
                """
            )
            job = cur.fetchone()
            if not job:
                return

            job_id = str(job["job_id"])
            document_id = str(job["document_id"])
            log.info(f"Picked up job {job_id} for document {document_id}")

        conn.commit()
        conn.close()

        process_document(job_id, document_id)

    except Exception as e:
        log.error(f"Poll error: {e}")
        try:
            conn.close()
        except Exception:
            pass


def main():
    log.info("Document Sets Worker started. Polling every %ds...", POLL_INTERVAL_SECONDS)
    while True:
        try:
            poll_queue()
        except Exception as e:
            log.error(f"Unexpected error in main loop: {e}")
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
