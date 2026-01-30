import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { processJob } from '@/lib/job-processor';

export async function POST(request: Request) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Claim the oldest pending job
  const job = await prisma.conversionJob.findFirst({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  if (!job) {
    return NextResponse.json({ message: 'No pending jobs' }, { status: 200 });
  }

  try {
    await processJob(job.id);
    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Job processed successfully',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        jobId: job.id,
        error: message,
      },
      { status: 500 }
    );
  }
}
