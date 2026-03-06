import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDocsetsDb } from '@/lib/docsets-db';
import { prisma } from '@/lib/db';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as any;
  if (!user.isAdmin) return null;
  return user;
}

// GET /api/admin/document-sets — list all sets with doc counts and org access
export async function GET() {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = getDocsetsDb();
  const { rows } = await db.query(
    `SELECT
       ds.id,
       ds.name,
       ds.description,
       ds.created_by,
       ds.created_at,
       ds.updated_at,
       COUNT(DISTINCT d.id) AS doc_count,
       COALESCE(
         json_agg(
           json_build_object('id', o.id, 'name', o.name, 'slug', o.slug)
         ) FILTER (WHERE o.id IS NOT NULL),
         '[]'
       ) AS orgs
     FROM document_sets ds
     LEFT JOIN documents d ON d.document_set_id = ds.id
     LEFT JOIN document_set_access dsa ON dsa.document_set_id = ds.id
     LEFT JOIN organizations o ON o.id = dsa.organization_id
     GROUP BY ds.id
     ORDER BY ds.name`
  );

  return NextResponse.json({ sets: rows });
}

// POST /api/admin/document-sets — create a new set
export async function POST(req: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { name, description, orgIds = [] } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const db = getDocsetsDb();
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Create set
    const setResult = await client.query<{ id: string }>(
      `INSERT INTO document_sets (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [name.trim(), description?.trim() || null, adminUser.email]
    );
    const setId = setResult.rows[0].id;

    // Sync orgs and grant access
    for (const orgId of orgIds) {
      // Ensure org exists in docsets DB (sync from main DB)
      const mainOrg = await prisma.organization.findUnique({ where: { id: orgId } });
      if (mainOrg) {
        await client.query(
          `INSERT INTO organizations (id, name, slug)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug`,
          [mainOrg.id, mainOrg.name, mainOrg.slug]
        );
        await client.query(
          `INSERT INTO document_set_access (document_set_id, organization_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [setId, orgId]
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ id: setId }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[admin/document-sets POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
