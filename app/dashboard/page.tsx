import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // TEMPORARY: Use mock user for testing when auth is disabled
  const mockUser = user || {
    id: 'b2faae05-83a5-4310-8533-f684bce2f708',
    email: 'cory@advientadvisors.com',
    aud: 'authenticated',
    role: 'authenticated',
  } as any;

  // if (!user) {
  //   redirect('/login');
  // }

  // Fetch user's recent jobs
  const { data: jobs } = await supabase
    .from('conversion_jobs')
    .select('*')
    .eq('user_id', mockUser.id)
    .order('created_at', { ascending: false })
    .limit(5);

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', mockUser.id)
    .single();

  return (
    <DashboardClient
      user={mockUser}
      profile={profile}
      initialJobs={jobs || []}
    />
  );
}
