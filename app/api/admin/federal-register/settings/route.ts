/**
 * Federal Register Monitor Settings Endpoint
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authentikId = (session.user as any).authentikId;
    const dbUser = await prisma.user.findUnique({ where: { authentikId } });

    if (!dbUser?.isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // Get current settings
    const currentSettings = await prisma.federalRegisterSettings.findFirst();
    if (!currentSettings) {
      return Response.json({ error: 'Settings not found' }, { status: 404 });
    }

    // Build update data from provided fields
    const updateData: any = {};
    if (body.isEnabled !== undefined) updateData.isEnabled = body.isEnabled;
    if (body.pollIntervalMinutes !== undefined) updateData.pollIntervalMinutes = body.pollIntervalMinutes;
    if (body.agencySlugs !== undefined) updateData.agencySlugs = body.agencySlugs;
    if (body.documentTypes !== undefined) updateData.documentTypes = body.documentTypes;
    if (body.onlySignificant !== undefined) updateData.onlySignificant = body.onlySignificant;
    if (body.defaultTargetUserId !== undefined) updateData.defaultTargetUserId = body.defaultTargetUserId;
    if (body.autoProcessNew !== undefined) updateData.autoProcessNew = body.autoProcessNew;

    // Also accept snake_case from existing frontend
    if (body.is_enabled !== undefined) updateData.isEnabled = body.is_enabled;
    if (body.poll_interval_minutes !== undefined) updateData.pollIntervalMinutes = body.poll_interval_minutes;
    if (body.agency_slugs !== undefined) updateData.agencySlugs = body.agency_slugs;
    if (body.document_types !== undefined) updateData.documentTypes = body.document_types;
    if (body.only_significant !== undefined) updateData.onlySignificant = body.only_significant;
    if (body.default_target_user_id !== undefined) updateData.defaultTargetUserId = body.default_target_user_id;
    if (body.auto_process_new !== undefined) updateData.autoProcessNew = body.auto_process_new;

    const updatedSettings = await prisma.federalRegisterSettings.update({
      where: { id: currentSettings.id },
      data: updateData,
    });

    return Response.json({
      success: true,
      settings: updatedSettings,
    });
  } catch (error: any) {
    console.error('[FR Settings] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
