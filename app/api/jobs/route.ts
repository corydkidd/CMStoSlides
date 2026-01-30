import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authentikId = (session.user as any).authentikId;
  const dbUser = await prisma.user.findUnique({
    where: { authentikId },
  });

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  const jobs = await prisma.conversionJob.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Serialize BigInt
  const serializedJobs = jobs.map((j) => ({
    ...j,
    inputSizeBytes: j.inputSizeBytes ? Number(j.inputSizeBytes) : null,
    outputSizeBytes: j.outputSizeBytes ? Number(j.outputSizeBytes) : null,
  }));

  return NextResponse.json({ jobs: serializedJobs });
}
