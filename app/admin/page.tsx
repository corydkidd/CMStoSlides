import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminDashboardClient } from './AdminDashboardClient';

export default async function AdminDashboardPage() {
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

  // Fetch admin dashboard stats
  const { data: allUsers } = await supabase
    .from('profiles')
    .select('id, email, full_name, is_active, created_at')
    .order('created_at', { ascending: false });

  const { data: allJobs } = await supabase
    .from('conversion_jobs')
    .select('id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <AdminDashboardClient
      user={user}
      profile={profile}
      users={allUsers || []}
      recentJobs={allJobs || []}
    />
  );
}
