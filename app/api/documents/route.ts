/**
 * Documents API - List regulatory documents for current organization
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get current user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with organization
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        organization: {
          include: {
            organizationAgencies: {
              include: {
                agency: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.organization) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status'); // Filter document outputs by status

    // Get agency IDs this org is subscribed to
    const agencyIds = user.organization.organizationAgencies.map(oa => oa.agencyId);

    // Get regulatory documents with their outputs for this org
    const documents = await prisma.regulatoryDocument.findMany({
      where: {
        agencyId: { in: agencyIds },
      },
      include: {
        agency: true,
        documentOutputs: {
          where: {
            organizationId: user.organizationId!,
            ...(status && { status }),
          },
          include: {
            clientOutputs: {
              include: {
                client: true,
              },
            },
          },
        },
      },
      orderBy: {
        publicationDate: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // Get total count
    const total = await prisma.regulatoryDocument.count({
      where: {
        agencyId: { in: agencyIds },
      },
    });

    return Response.json({
      documents,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });

  } catch (error: any) {
    console.error('[Documents API] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
