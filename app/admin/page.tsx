import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AdminDashboardClient } from './AdminDashboardClient';

export default async function AdminDashboardPage() {
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

  // Fetch admin dashboard stats
  const allUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      isAdmin: true,
      createdAt: true,
    },
  });

  const recentJobs = await prisma.conversionJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      status: true,
      createdAt: true,
    },
  });

  return (
    <AdminDashboardClient
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
      users={allUsers.map((u) => ({
        id: u.id,
        email: u.email,
        full_name: u.name,
        is_active: u.isActive,
        is_admin: u.isAdmin,
        created_at: u.createdAt.toISOString(),
      }))}
      recentJobs={recentJobs.map((j) => ({
        id: j.id,
        status: j.status,
        created_at: j.createdAt.toISOString(),
      }))}
    />
  );
}
