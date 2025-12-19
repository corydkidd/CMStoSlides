import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UsersManagementClient } from './UsersManagementClient';

export default async function UsersManagementPage() {
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

  // Fetch all users with their job counts
  const { data: users } = await supabase
    .from('profiles')
    .select(`
      *,
      conversion_jobs (count)
    `)
    .order('created_at', { ascending: false });

  return (
    <UsersManagementClient
      user={user}
      profile={profile}
      users={users || []}
    />
  );
}
