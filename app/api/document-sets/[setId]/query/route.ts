/**
 * POST /api/document-sets/:setId/query
 *
 * Stateless RAG query pipeline:
 *   1. Embed question (OpenAI text-embedding-3-large)
 *   2. Hybrid retrieval: vector cosine + full-text tsvector
 *   3. Merge, deduplicate, re-rank, take top 10
 *   4. Build Claude prompt with citations
 *   5. Return answer + sources
 *   6. Log to query_log
 *
 * Accepts optional conversation_id for API contract stability (Phase 2 ready).
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDocsetsDb, syncOrgToDocsets } from '@/lib/docsets-db';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EMBEDDING_MODEL = 'text-embedding-3-large';
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const VECTOR_TOP_K = 15;
const FTS_TOP_K = 10;
const FINAL_TOP_K = 10;

interface Source {
  document_title: string;
  section: string | null;
  section_title: string | null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { setId } = await params;
  const user = session.user as any;
  const org = user.organization;

  if (!org) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const question: string = body.question?.trim();
  // conversation_id accepted but not used in Phase 1 (Phase 2 will thread history)
  // const conversationId: string | undefined = body.conversation_id;

  if (!question) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }

  await syncOrgToDocsets(org.id, org.name, org.slug);

  const db = getDocsetsDb();

  // Verify access
  const accessCheck = await db.query(
    `SELECT ds.id, ds.name
     FROM document_sets ds
     JOIN document_set_access dsa ON dsa.document_set_id = ds.id
     WHERE ds.id = $1 AND dsa.organization_id = $2`,
    [setId, org.id]
  );

  if (accessCheck.rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Check there are ready documents
  const readyCheck = await db.query(
    `SELECT COUNT(*) as count FROM documents WHERE document_set_id = $1 AND status = 'ready'`,
    [setId]
  );
  if (parseInt(readyCheck.rows[0].count, 10) === 0) {
    return NextResponse.json({
      answer: 'No documents are ready for querying in this set yet. Please wait for processing to complete.',
      sources: [],
    });
  }

  // --- Step 1: Embed the question ---
  const embedResponse = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: question,
  });
  const queryEmbedding = embedResponse.data[0].embedding;
  const embeddingStr = '[' + queryEmbedding.join(',') + ']';

  // --- Step 2a: Vector similarity search ---
  const vectorResults = await db.query<{
    id: string;
    content: string;
    section_path: string | null;
    section_title: string | null;
    document_id: string;
    doc_title: string;
    similarity: number;
  }>(
    `SELECT
       dc.id,
       dc.content,
       dc.section_path,
       dc.section_title,
       dc.document_id,
       d.title AS doc_title,
       1 - (dc.embedding::halfvec(3072) <=> $2::halfvec(3072)) AS similarity
     FROM document_chunks dc
     JOIN documents d ON d.id = dc.document_id
     WHERE dc.document_set_id = $1
       AND d.status = 'ready'
     ORDER BY dc.embedding::halfvec(3072) <=> $2::halfvec(3072)
     LIMIT $3`,
    [setId, embeddingStr, VECTOR_TOP_K]
  );

  // --- Step 2b: Full-text keyword search ---
  const ftsResults = await db.query<{
    id: string;
    content: string;
    section_path: string | null;
    section_title: string | null;
    document_id: string;
    doc_title: string;
    rank: number;
  }>(
    `SELECT
       dc.id,
       dc.content,
       dc.section_path,
       dc.section_title,
       dc.document_id,
       d.title AS doc_title,
       ts_rank_cd(dc.tsv, plainto_tsquery('english', $2)) AS rank
     FROM document_chunks dc
     JOIN documents d ON d.id = dc.document_id
     WHERE dc.document_set_id = $1
       AND d.status = 'ready'
       AND dc.tsv @@ plainto_tsquery('english', $2)
     ORDER BY rank DESC
     LIMIT $3`,
    [setId, question, FTS_TOP_K]
  );

  // --- Step 2c: Merge, deduplicate, re-rank by combined score ---
  const chunkMap = new Map<
    string,
    { content: string; section_path: string | null; section_title: string | null; doc_title: string; score: number }
  >();

  for (const row of vectorResults.rows) {
    chunkMap.set(row.id, {
      content: row.content,
      section_path: row.section_path,
      section_title: row.section_title,
      doc_title: row.doc_title,
      score: row.similarity * 0.7, // weight vector search
    });
  }

  for (const row of ftsResults.rows) {
    if (chunkMap.has(row.id)) {
      chunkMap.get(row.id)!.score += row.rank * 0.3; // bonus for FTS match
    } else {
      chunkMap.set(row.id, {
        content: row.content,
        section_path: row.section_path,
        section_title: row.section_title,
        doc_title: row.doc_title,
        score: row.rank * 0.3,
      });
    }
  }

  const topChunks = [...chunkMap.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, FINAL_TOP_K);

  if (topChunks.length === 0) {
    return NextResponse.json({
      answer: 'I could not find relevant content in these documents to answer your question. Try rephrasing or using different keywords.',
      sources: [],
    });
  }

  // --- Step 3: Build Claude prompt ---
  const contextBlocks = topChunks
    .map(([, chunk], i) => {
      const sectionLabel = chunk.section_path
        ? `§${chunk.section_path}${chunk.section_title ? ' — ' + chunk.section_title : ''}`
        : chunk.section_title || '';
      return `[${i + 1}] ${chunk.doc_title}${sectionLabel ? ` | ${sectionLabel}` : ''}\n${chunk.content}`;
    })
    .join('\n\n---\n\n');

  const systemPrompt = `You are a regulatory document analyst. Answer the user's question based ONLY on the provided document excerpts below.

Rules:
- Cite the document title and section for every factual claim using format: (Document Title, §section)
- If the excerpts do not contain sufficient information to answer, say so explicitly and do not speculate
- Be precise and use regulatory terminology accurately
- Structure your answer clearly with paragraphs for complex answers`;

  const userPrompt = `Document excerpts:\n\n${contextBlocks}\n\n---\n\nQuestion: ${question}`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  const answerText =
    response.content[0].type === 'text' ? response.content[0].text : '';

  // Build deduplicated sources list
  const seenSources = new Set<string>();
  const sources: Source[] = [];
  for (const [, chunk] of topChunks) {
    const key = `${chunk.doc_title}|${chunk.section_path ?? ''}`;
    if (!seenSources.has(key)) {
      seenSources.add(key);
      sources.push({
        document_title: chunk.doc_title,
        section: chunk.section_path,
        section_title: chunk.section_title,
      });
    }
  }

  // --- Step 4: Log to query_log ---
  try {
    const chunkIds = topChunks.map(([id]) => id);
    await db.query(
      `INSERT INTO query_log
         (document_set_id, user_id, organization_id, query_text, response_text, chunks_used)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [setId, user.id, org.id, question, answerText, chunkIds]
    );
  } catch (err) {
    console.error('[query] Failed to log query:', err);
  }

  return NextResponse.json({ answer: answerText, sources });
}
