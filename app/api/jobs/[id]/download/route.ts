import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;

  // Verify user is authenticated
  const supabaseAuth = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = getAdminClient();

  // Fetch the job
  const { data: job, error: jobError } = await adminClient
    .from('conversion_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Check ownership or admin
  const { data: profile } = await adminClient
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.is_admin === true;
  const isOwner = job.user_id === user.id;

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Verify job is complete with an output path
  if (job.status !== 'complete' || !job.output_path) {
    return NextResponse.json(
      { error: 'Job output not available' },
      { status: 400 }
    );
  }

  // Create a signed URL (valid for 60 minutes)
  const { data: signedData, error: signError } = await adminClient.storage
    .from('outputs')
    .createSignedUrl(job.output_path, 3600);

  if (signError || !signedData?.signedUrl) {
    return NextResponse.json(
      { error: 'Failed to generate download URL' },
      { status: 500 }
    );
  }

  // Return JSON with URL (let client handle redirect/download)
  return NextResponse.json({
    url: signedData.signedUrl,
    filename: job.output_filename || 'presentation.pptx',
  });
}
