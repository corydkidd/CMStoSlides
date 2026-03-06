import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ organizations: orgs });
}
