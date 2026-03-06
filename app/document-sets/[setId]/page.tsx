import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DocumentSetQueryClient } from './DocumentSetQueryClient';

export default async function DocumentSetQueryPage({
  params,
}: {
  params: Promise<{ setId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/signin');

  const authentikId = (session.user as any).authentikId;
  const dbUser = await prisma.user.findUnique({
    where: { authentikId },
    include: { organization: { select: { id: true, name: true, slug: true } } },
  });
  if (!dbUser) redirect('/auth/signin');

  const { setId } = await params;

  return (
    <DocumentSetQueryClient
      setId={setId}
      user={{ id: dbUser.id, email: dbUser.email, name: dbUser.name }}
      profile={{ full_name: dbUser.name, email: dbUser.email, is_admin: dbUser.isAdmin }}
    />
  );
}
