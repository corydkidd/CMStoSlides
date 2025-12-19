import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { HistoryClient } from './HistoryClient';

export default async function HistoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch all user's jobs
  const { data: jobs } = await supabase
    .from('conversion_jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <HistoryClient
      user={user}
      profile={profile}
      jobs={jobs || []}
    />
  );
}
