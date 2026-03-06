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

// PUT /api/admin/document-sets/:setId — update name, description, org access
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { setId } = await params;
  const body = await req.json().catch(() => ({}));
  const { name, description, orgIds } = body;

  const db = getDocsetsDb();
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Update set metadata
    if (name !== undefined || description !== undefined) {
      await client.query(
        `UPDATE document_sets
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             updated_at = now()
         WHERE id = $3`,
        [name?.trim() || null, description?.trim() ?? null, setId]
      );
    }

    // Replace org access if provided
    if (Array.isArray(orgIds)) {
      await client.query('DELETE FROM document_set_access WHERE document_set_id = $1', [setId]);

      for (const orgId of orgIds) {
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
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [setId, orgId]
          );
        }
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[admin/document-sets PUT]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE /api/admin/document-sets/:setId
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { setId } = await params;
  const db = getDocsetsDb();

  // Cascade deletes handle documents, chunks, access rows via FK constraints
  await db.query('DELETE FROM document_sets WHERE id = $1', [setId]);
  return NextResponse.json({ ok: true });
}
