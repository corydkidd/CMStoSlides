import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getFileBuffer } from '@/lib/storage';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;

  // Verify user is authenticated
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

  // Fetch the job
  const job = await prisma.conversionJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Check ownership or admin
  const isOwner = job.userId === dbUser.id;
  const isAdmin = dbUser.isAdmin;

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Verify job is complete with an output path
  if (job.status !== 'complete' || !job.outputPath) {
    return NextResponse.json(
      { error: 'Job output not available' },
      { status: 400 }
    );
  }

  // Serve the file directly
  try {
    const buffer = await getFileBuffer(job.outputPath);
    const filename = job.outputFilename || 'presentation.pptx';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to read output file' },
      { status: 500 }
    );
  }
}
