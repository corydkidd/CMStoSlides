/**
 * Document Sets database connection (pg pool → docsets-db / pgvector).
 *
 * Org sync strategy: orgs are synced from the main app DB into this DB on
 * demand via syncOrgToDocsets(). Each document-sets API call checks and upserts
 * the calling user's org so the docsets DB stays in sync without requiring
 * schema sharing or a separate sync job.
 */

import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDocsetsDb(): Pool {
  if (!pool) {
    const url = process.env.DOCSETS_DB_URL;
    if (!url) {
      throw new Error('DOCSETS_DB_URL environment variable is not set');
    }
    pool = new Pool({ connectionString: url, max: 10 });
  }
  return pool;
}

/**
 * Sync an organization from the main app DB into the docsets DB.
 * Uses INSERT ... ON CONFLICT DO NOTHING — safe to call on every request.
 */
export async function syncOrgToDocsets(
  orgId: string,
  orgName: string,
  orgSlug: string
): Promise<void> {
  const db = getDocsetsDb();
  await db.query(
    `INSERT INTO organizations (id, name, slug)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug`,
    [orgId, orgName, orgSlug]
  );
}

// --- Type definitions for the docsets schema ---

export interface DocSet {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface DocSetWithAccess extends DocSet {
  doc_count: number;
  ready_count: number;
  org_ids: string[];
}

export interface DocSetDocument {
  id: string;
  document_set_id: string;
  title: string;
  filename: string;
  file_path: string;
  word_count: number | null;
  status: 'pending' | 'processing' | 'ready' | 'error';
  status_message: string | null;
  uploaded_at: Date;
  processed_at: Date | null;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  document_set_id: string;
  chunk_index: number;
  content: string;
  section_path: string | null;
  section_title: string | null;
  token_count: number | null;
}

export interface QueryLogEntry {
  id: string;
  document_set_id: string;
  user_id: string;
  organization_id: string | null;
  query_text: string;
  response_text: string | null;
  chunks_used: string[] | null;
  created_at: Date;
}
