import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // TEMPORARY: Create mock user for development
  // TODO: Re-enable authentication once cookie issues are resolved
  const mockUser = user || {
    id: '63e2d1f3-4051-4b4c-b4d7-1cc3c8534e8c',
    email: 'test@example.com',
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
