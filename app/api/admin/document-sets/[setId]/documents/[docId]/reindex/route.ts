import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDocsetsDb } from '@/lib/docsets-db';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as any;
  if (!user.isAdmin) return null;
  return user;
}

// POST /api/admin/document-sets/:setId/documents/:docId/reindex
// Re-queues the document for processing, deletes existing chunks first.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ setId: string; docId: string }> }
) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { docId } = await params;
  const db = getDocsetsDb();
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Delete existing chunks
    await client.query('DELETE FROM document_chunks WHERE document_id = $1', [docId]);

    // Reset document status to pending
    await client.query(
      `UPDATE documents SET status = 'pending', status_message = NULL, processed_at = NULL WHERE id = $1`,
      [docId]
    );

    // Cancel any existing pending queue entry, then add a new one
    await client.query(
      `DELETE FROM processing_queue WHERE document_id = $1 AND started_at IS NULL`,
      [docId]
    );
    await client.query(
      `INSERT INTO processing_queue (document_id) VALUES ($1)`,
      [docId]
    );

    await client.query('COMMIT');
    return NextResponse.json({ ok: true, message: 'Document queued for re-indexing' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[admin/reindex]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
