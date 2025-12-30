/**
 * Federal Register Monitor Settings Endpoint
 *
 * Update monitoring configuration
 */

import { createServerClient } from '@/lib/supabase/server';

export async function PATCH(request: Request) {
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

    // Get request body
    const body = await request.json();

    // Get current settings
    const { data: currentSettings } = await supabase
      .from('federal_register_settings')
      .select('id')
      .single();

    if (!currentSettings) {
      return Response.json({ error: 'Settings not found' }, { status: 404 });
    }

    // Update settings
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Only update fields that are provided
    if (body.is_enabled !== undefined) updateData.is_enabled = body.is_enabled;
    if (body.poll_interval_minutes !== undefined)
      updateData.poll_interval_minutes = body.poll_interval_minutes;
    if (body.agency_slugs !== undefined) updateData.agency_slugs = body.agency_slugs;
    if (body.document_types !== undefined) updateData.document_types = body.document_types;
    if (body.only_significant !== undefined) updateData.only_significant = body.only_significant;
    if (body.default_target_user_id !== undefined)
      updateData.default_target_user_id = body.default_target_user_id;
    if (body.auto_process_new !== undefined) updateData.auto_process_new = body.auto_process_new;

    const { data: updatedSettings, error: updateError } = await supabase
      .from('federal_register_settings')
      .update(updateData)
      .eq('id', currentSettings.id)
      .select()
      .single();

    if (updateError) {
      return Response.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return Response.json({
      success: true,
      settings: updatedSettings,
    });
  } catch (error: any) {
    console.error('[FR Settings] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
