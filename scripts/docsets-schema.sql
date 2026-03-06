-- Document Sets Schema for pgvector database
-- Run against the docsets-db container

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Organizations (mirrors existing app's org concept; synced on user login via upsert)
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Document sets
CREATE TABLE IF NOT EXISTS document_sets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  created_by   TEXT NOT NULL,  -- admin user identifier (email)
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Org access to document sets (org-level, not user-level)
CREATE TABLE IF NOT EXISTS document_set_access (
  document_set_id  UUID REFERENCES document_sets(id) ON DELETE CASCADE,
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  granted_at       TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (document_set_id, organization_id)
);

-- Documents within a set
CREATE TABLE IF NOT EXISTS documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_set_id   UUID REFERENCES document_sets(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  filename          TEXT NOT NULL,
  file_path         TEXT NOT NULL,       -- path to PDF on disk
  word_count        INTEGER,
  status            TEXT NOT NULL DEFAULT 'pending',
                    -- pending | processing | ready | error
  status_message    TEXT,                -- error detail if failed
  uploaded_at       TIMESTAMPTZ DEFAULT now(),
  processed_at      TIMESTAMPTZ
);

-- Processing queue
CREATE TABLE IF NOT EXISTS processing_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID REFERENCES documents(id) ON DELETE CASCADE,
  queued_at    TIMESTAMPTZ DEFAULT now(),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error        TEXT
);

-- Chunks with embeddings (text-embedding-3-large: 3072 dimensions)
CREATE TABLE IF NOT EXISTS document_chunks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID REFERENCES documents(id) ON DELETE CASCADE,
  document_set_id  UUID REFERENCES document_sets(id) ON DELETE CASCADE,
  chunk_index      INTEGER NOT NULL,
  content          TEXT NOT NULL,
  section_path     TEXT,    -- e.g. "II.A.3.b"
  section_title    TEXT,    -- human-readable section heading
  token_count      INTEGER,
  embedding        vector(3072),   -- text-embedding-3-large dimension
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Full-text search column
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Indexes
-- Note: ivfflat supports max 2000 dims; text-embedding-3-large is 3072 dims.
-- Use HNSW on halfvec cast (pgvector 0.8+) which supports up to 4000 dims.
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
  ON document_chunks USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
CREATE INDEX IF NOT EXISTS document_chunks_document_set_id_idx ON document_chunks (document_set_id);
CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks (document_id);
CREATE INDEX IF NOT EXISTS document_chunks_tsv_idx ON document_chunks USING GIN (tsv);

-- Query log (foundation for future conversation history)
CREATE TABLE IF NOT EXISTS query_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_set_id  UUID REFERENCES document_sets(id),
  user_id          TEXT NOT NULL,
  organization_id  UUID REFERENCES organizations(id),
  query_text       TEXT NOT NULL,
  response_text    TEXT,
  chunks_used      UUID[],    -- chunk IDs that were retrieved
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS query_log_user_set_idx ON query_log (user_id, document_set_id);
CREATE INDEX IF NOT EXISTS query_log_document_set_id_idx ON query_log (document_set_id);
