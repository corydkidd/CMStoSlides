import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const authentikId = (session.user as any).authentikId;
  const dbUser = await prisma.user.findUnique({
    where: { authentikId },
  });

  if (!dbUser) {
    redirect('/auth/signin');
  }

  // Fetch user's recent jobs
  const jobs = await prisma.conversionJob.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  // Serialize BigInt fields for client component
  const serializedJobs = jobs.map((j) => ({
    ...j,
    inputSizeBytes: j.inputSizeBytes ? Number(j.inputSizeBytes) : null,
    outputSizeBytes: j.outputSizeBytes ? Number(j.outputSizeBytes) : null,
  }));

  return (
    <DashboardClient
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
      initialJobs={serializedJobs}
    />
  );
}
