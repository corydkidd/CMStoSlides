/**
 * Federal Register Manual Check Endpoint
 *
 * Manually trigger a Federal Register check (for testing)
 */

import { createServerClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createServerClient();

    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Trigger the cron endpoint internally
    const cronUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/cron/check-federal-register`;

    const response = await fetch(cronUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: 'Check failed', details: data },
        { status: response.status }
      );
    }

    return Response.json({
      success: true,
      result: data,
    });
  } catch (error: any) {
    console.error('[FR Check Now] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
