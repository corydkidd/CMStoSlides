import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDocsetsDb, syncOrgToDocsets } from '@/lib/docsets-db';

export async function GET(
  _req: Request,
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

  await syncOrgToDocsets(org.id, org.name, org.slug);

  const db = getDocsetsDb();

  // Verify this org has access
  const accessCheck = await db.query(
    `SELECT ds.id, ds.name, ds.description
     FROM document_sets ds
     JOIN document_set_access dsa ON dsa.document_set_id = ds.id
     WHERE ds.id = $1 AND dsa.organization_id = $2`,
    [setId, org.id]
  );

  if (accessCheck.rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const set = accessCheck.rows[0];

  // Fetch documents in this set
  const docsResult = await db.query(
    `SELECT id, title, filename, status, status_message, word_count, uploaded_at, processed_at
     FROM documents
     WHERE document_set_id = $1
     ORDER BY uploaded_at DESC`,
    [setId]
  );

  return NextResponse.json({
    set: {
      id: set.id,
      name: set.name,
      description: set.description,
    },
    documents: docsResult.rows,
  });
}
