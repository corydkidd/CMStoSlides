import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AdminDocSetDetailClient } from './AdminDocSetDetailClient';

export default async function AdminDocSetDetailPage({
  params,
}: {
  params: Promise<{ setId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/signin');

  const authentikId = (session.user as any).authentikId;
  const dbUser = await prisma.user.findUnique({ where: { authentikId } });
  if (!dbUser || !dbUser.isAdmin) redirect('/dashboard');

  const { setId } = await params;

  return (
    <AdminDocSetDetailClient
      setId={setId}
      user={{ id: dbUser.id, email: dbUser.email, name: dbUser.name }}
      profile={{ full_name: dbUser.name, email: dbUser.email, is_admin: dbUser.isAdmin }}
    />
  );
}
