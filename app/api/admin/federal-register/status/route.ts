/**
 * Federal Register Monitor Status Endpoint
 *
 * Returns current settings and recent activity
 */

import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
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

    // Get settings
    const { data: settings, error: settingsError } = await supabase
      .from('federal_register_settings')
      .select('*')
      .single();

    if (settingsError) {
      return Response.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    // Get recent documents
    const { data: recentDocuments, error: docsError } = await supabase
      .from('federal_register_documents')
      .select('*')
      .order('publication_date', { ascending: false })
      .limit(10);

    if (docsError) {
      return Response.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    // Get statistics
    const { count: totalCount } = await supabase
      .from('federal_register_documents')
      .select('*', { count: 'exact', head: true });

    const { count: todayCount } = await supabase
      .from('federal_register_documents')
      .select('*', { count: 'exact', head: true })
      .gte('detected_at', new Date().toISOString().split('T')[0]);

    return Response.json({
      settings,
      recentDocuments,
      stats: {
        total: totalCount || 0,
        today: todayCount || 0,
      },
    });
  } catch (error: any) {
    console.error('[FR Status] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
