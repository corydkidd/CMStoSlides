import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDocsetsDb, syncOrgToDocsets } from '@/lib/docsets-db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  const org = user.organization;

  if (!org) {
    return NextResponse.json({ sets: [] });
  }

  // Sync org into docsets DB on demand
  await syncOrgToDocsets(org.id, org.name, org.slug);

  const db = getDocsetsDb();

  // Fetch document sets accessible to this org
  const { rows } = await db.query<{
    id: string;
    name: string;
    description: string | null;
    doc_count: string;
    ready_count: string;
  }>(
    `SELECT
       ds.id,
       ds.name,
       ds.description,
       COUNT(d.id) AS doc_count,
       COUNT(d.id) FILTER (WHERE d.status = 'ready') AS ready_count
     FROM document_sets ds
     JOIN document_set_access dsa ON dsa.document_set_id = ds.id
     JOIN organizations o ON o.id = dsa.organization_id
     LEFT JOIN documents d ON d.document_set_id = ds.id
     WHERE o.id = $1
     GROUP BY ds.id
     ORDER BY ds.name`,
    [org.id]
  );

  const sets = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    docCount: parseInt(r.doc_count, 10),
    readyCount: parseInt(r.ready_count, 10),
  }));

  return NextResponse.json({ sets });
}
