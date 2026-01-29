import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminDashboardClient } from './AdminDashboardClient';

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // TEMPORARY: Use mock admin user for testing
  const mockUser = user || {
    id: 'b2faae05-83a5-4310-8533-f684bce2f708',
    email: 'cory@advientadvisors.com',
    aud: 'authenticated',
    role: 'authenticated',
  } as any;

  // if (!user) {
  //   redirect('/login');
  // }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', mockUser.id)
    .single();

  // TEMPORARY: Skip admin check for testing
  // if (!(profile as any)?.is_admin) {
  //   redirect('/dashboard');
  // }

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
      user={mockUser}
      profile={profile}
      users={allUsers || []}
      recentJobs={allJobs || []}
    />
  );
}
