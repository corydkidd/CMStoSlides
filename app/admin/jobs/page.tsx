import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { JobsManagementClient } from './JobsManagementClient';

export default async function JobsManagementPage() {
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

  // Fetch all jobs with user info
  const jobs = await prisma.conversionJob.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  // Serialize BigInt and format for client
  const serializedJobs = jobs.map((j) => ({
    ...j,
    inputSizeBytes: j.inputSizeBytes ? Number(j.inputSizeBytes) : null,
    outputSizeBytes: j.outputSizeBytes ? Number(j.outputSizeBytes) : null,
    // Map to expected shape for JobCard compatibility
    profiles: {
      email: j.user.email,
      full_name: j.user.name,
    },
  }));

  return (
    <JobsManagementClient
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
      jobs={serializedJobs}
    />
  );
}
