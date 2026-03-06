import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDocsetsDb } from '@/lib/docsets-db';
import { unlink } from 'fs/promises';
import path from 'path';

const UPLOADS_BASE = '/app/data/docsets';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as any;
  if (!user.isAdmin) return null;
  return user;
}

// DELETE /api/admin/document-sets/:setId/documents/:docId
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ setId: string; docId: string }> }
) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { setId, docId } = await params;
  const db = getDocsetsDb();

  // Get file path before deleting
  const { rows } = await db.query<{ file_path: string }>(
    `SELECT file_path FROM documents WHERE id = $1 AND document_set_id = $2`,
    [docId, setId]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const filePath = rows[0].file_path;

  // Delete from DB (cascades to document_chunks and processing_queue)
  await db.query('DELETE FROM documents WHERE id = $1', [docId]);

  // Delete file from disk (non-fatal if missing)
  try {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(UPLOADS_BASE, filePath);
    await unlink(fullPath);
  } catch {
    // File may have already been removed; continue
  }

  return NextResponse.json({ ok: true });
}
