import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { JobsManagementClient } from './JobsManagementClient';

export default async function JobsManagementPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!(profile as any)?.is_admin) {
    redirect('/dashboard');
  }

  // Fetch all jobs with user info
  const { data: jobs } = await supabase
    .from('conversion_jobs')
    .select(`
      *,
      profiles (
        email,
        full_name
      )
    `)
    .order('created_at', { ascending: false });

  return (
    <JobsManagementClient
      user={user}
      profile={profile}
      jobs={jobs || []}
    />
  );
}
