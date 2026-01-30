/**
 * Federal Register Manual Check Endpoint
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST() {
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

    // Trigger the cron endpoint internally
    const cronUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/cron/check-federal-register`;

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
