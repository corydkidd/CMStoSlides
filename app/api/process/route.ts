import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processJob } from '@/lib/job-processor';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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

  const supabase = getAdminClient();

  // Claim the oldest pending job
  const { data: job, error: fetchError } = await supabase
    .from('conversion_jobs')
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (fetchError || !job) {
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
