import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UsersManagementClient } from './UsersManagementClient';

export default async function UsersManagementPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const authentikId = (session.user as any).authentikId;
  const dbUser = await prisma.user.findUnique({
    where: { authentikId },
  });

  if (!dbUser || !dbUser.isAdmin) {
    redirect('/dashboard');
  }

  // Fetch all users with their job counts
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { conversionJobs: true },
      },
    },
  });

  return (
    <UsersManagementClient
      user={{
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
      }}
      profile={{
        full_name: dbUser.name,
        email: dbUser.email,
        is_admin: dbUser.isAdmin,
      }}
      users={users.map((u) => ({
        id: u.id,
        email: u.email,
        full_name: u.name,
        is_active: u.isActive,
        is_admin: u.isAdmin,
        template_path: u.templatePath,
        created_at: u.createdAt.toISOString(),
        conversion_jobs: [{ count: u._count.conversionJobs }],
      }))}
    />
  );
}
