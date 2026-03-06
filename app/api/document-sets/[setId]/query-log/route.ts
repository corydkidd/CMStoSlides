import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDocsetsDb } from '@/lib/docsets-db';

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

  const db = getDocsetsDb();
  const { rows } = await db.query(
    `SELECT id, query_text, response_text, created_at
     FROM query_log
     WHERE document_set_id = $1 AND user_id = $2
     ORDER BY created_at DESC
     LIMIT 20`,
    [setId, user.id]
  );

  return NextResponse.json({ log: rows });
}
