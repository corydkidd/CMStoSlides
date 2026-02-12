/**
 * Document Detail API
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

    // Get document with outputs for this org
    const document = await prisma.regulatoryDocument.findUnique({
      where: { id: params.id },
      include: {
        agency: true,
        documentOutputs: {
          where: {
            organizationId: user.organizationId,
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
    });

    if (!document) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    return Response.json({ document });

  } catch (error: any) {
    console.error('[Document Detail API] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
