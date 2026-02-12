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
    take: 20,
  });

  // Look up linked Federal Register documents for titles/URLs
  const jobIds = jobs.map((j) => j.id);
  const frDocs = await prisma.federalRegisterDocument.findMany({
    where: { conversionJobId: { in: jobIds } },
    select: {
      conversionJobId: true,
      title: true,
      htmlUrl: true,
      citation: true,
      documentNumber: true,
      publicationDate: true,
    },
  });
  const frDocByJobId = new Map(frDocs.map((d) => [d.conversionJobId, d]));

  // Serialize BigInt fields and attach FR metadata for client component
  const serializedJobs = jobs.map((j) => {
    const frDoc = frDocByJobId.get(j.id);
    return {
      ...j,
      inputSizeBytes: j.inputSizeBytes ? Number(j.inputSizeBytes) : null,
      outputSizeBytes: j.outputSizeBytes ? Number(j.outputSizeBytes) : null,
      documentTitle: frDoc?.title || null,
      documentUrl: frDoc?.htmlUrl || null,
      citation: frDoc?.citation || null,
      documentNumber: frDoc?.documentNumber || null,
      publicationDate: frDoc?.publicationDate || null,
    };
  });

  // Sort by publication date (newest first), falling back to createdAt
  serializedJobs.sort((a, b) => {
    const dateA = a.publicationDate ? new Date(a.publicationDate).getTime() : new Date(a.createdAt).getTime();
    const dateB = b.publicationDate ? new Date(b.publicationDate).getTime() : new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

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
