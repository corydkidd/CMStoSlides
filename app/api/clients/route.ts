/**
 * Clients API - CRUD for organization clients
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('include_inactive') === 'true';

    const clients = await prisma.client.findMany({
      where: {
        organizationId: user.organizationId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: {
        name: 'asc',
      },
    });

    return Response.json({ clients });

  } catch (error: any) {
    console.error('[Clients API] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        organization: true,
      },
    });

    if (!user || !user.organization) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if org has clients feature
    if (!user.organization.hasClients) {
      return Response.json(
        { error: 'Client management not enabled for this organization' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, context, industry, focus_areas } = body;

    if (!name || !context) {
      return Response.json(
        { error: 'name and context are required' },
        { status: 400 }
      );
    }

    // Create client
    const client = await prisma.client.create({
      data: {
        organizationId: user.organizationId!,
        name,
        context,
        industry: industry || null,
        focusAreas: focus_areas || [],
      },
    });

    console.log(`[Clients API] Created client: ${name}`);

    return Response.json({ client }, { status: 201 });

  } catch (error: any) {
    console.error('[Clients API] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
