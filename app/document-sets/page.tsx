import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DocumentSetsClient } from './DocumentSetsClient';

export default async function DocumentSetsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/signin');

  const authentikId = (session.user as any).authentikId;
  const dbUser = await prisma.user.findUnique({
    where: { authentikId },
    include: { organization: { select: { id: true, name: true, slug: true } } },
  });
  if (!dbUser) redirect('/auth/signin');

  return (
    <DocumentSetsClient
      user={{ id: dbUser.id, email: dbUser.email, name: dbUser.name }}
      profile={{ full_name: dbUser.name, email: dbUser.email, is_admin: dbUser.isAdmin }}
      organization={dbUser.organization}
    />
  );
}
