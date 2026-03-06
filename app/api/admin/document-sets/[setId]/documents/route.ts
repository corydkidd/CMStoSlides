import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDocsetsDb } from '@/lib/docsets-db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const UPLOADS_BASE = '/app/data/docsets';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as any;
  if (!user.isAdmin) return null;
  return user;
}

// GET /api/admin/document-sets/:setId/documents
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { setId } = await params;
  const db = getDocsetsDb();

  const { rows } = await db.query(
    `SELECT id, title, filename, status, status_message, word_count, uploaded_at, processed_at
     FROM documents
     WHERE document_set_id = $1
     ORDER BY uploaded_at DESC`,
    [setId]
  );

  return NextResponse.json({ documents: rows });
}

// POST /api/admin/document-sets/:setId/documents — multipart PDF upload
export async function POST(
  req: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { setId } = await params;

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const title = (formData.get('title') as string | null)?.trim();

  if (!file) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
  }

  const docTitle = title || file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
  const filename = file.name;

  // Save file to disk
  const setDir = path.join(UPLOADS_BASE, setId);
  await mkdir(setDir, { recursive: true });
  const filePath = path.join(setDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  // Insert document record
  const db = getDocsetsDb();
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO documents (document_set_id, title, filename, file_path, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id`,
    [setId, docTitle, filename, path.join(setId, filename)]
  );
  const docId = rows[0].id;

  // Queue for processing
  await db.query(
    `INSERT INTO processing_queue (document_id) VALUES ($1)`,
    [docId]
  );

  return NextResponse.json({ id: docId, title: docTitle, status: 'pending' }, { status: 201 });
}
