/**
 * Individual Client API - Get, Update, Delete
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || !user.organizationId) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    const client = await prisma.client.findFirst({
      where: {
        id: params.id,
        organizationId: user.organizationId,
      },
    });

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    return Response.json({ client });

  } catch (error: any) {
    console.error('[Client Detail API] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || !user.organizationId) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check client belongs to org
    const existingClient = await prisma.client.findFirst({
      where: {
        id: params.id,
        organizationId: user.organizationId,
      },
    });

    if (!existingClient) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { name, context, industry, focus_areas, is_active } = body;

    // Update client
    const client = await prisma.client.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(context !== undefined && { context }),
        ...(industry !== undefined && { industry }),
        ...(focus_areas !== undefined && { focusAreas: focus_areas }),
        ...(is_active !== undefined && { isActive: is_active }),
      },
    });

    console.log(`[Client API] Updated client: ${client.name}`);

    return Response.json({ client });

  } catch (error: any) {
    console.error('[Client Update API] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || !user.organizationId) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check client belongs to org
    const existingClient = await prisma.client.findFirst({
      where: {
        id: params.id,
        organizationId: user.organizationId,
      },
    });

    if (!existingClient) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Soft delete (set isActive to false)
    await prisma.client.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    console.log(`[Client API] Deactivated client: ${existingClient.name}`);

    return Response.json({ message: 'Client deactivated successfully' });

  } catch (error: any) {
    console.error('[Client Delete API] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
