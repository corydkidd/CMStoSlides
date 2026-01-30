/**
 * Federal Register Monitor Status Endpoint
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
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

    // Get settings
    const settings = await prisma.federalRegisterSettings.findFirst();
    if (!settings) {
      return Response.json({ error: 'Settings not found' }, { status: 500 });
    }

    // Get recent documents
    const recentDocuments = await prisma.federalRegisterDocument.findMany({
      orderBy: { publicationDate: 'desc' },
      take: 10,
    });

    // Get statistics
    const totalCount = await prisma.federalRegisterDocument.count();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = await prisma.federalRegisterDocument.count({
      where: { detectedAt: { gte: todayStart } },
    });

    return Response.json({
      settings,
      recentDocuments,
      stats: {
        total: totalCount,
        today: todayCount,
      },
    });
  } catch (error: any) {
    console.error('[FR Status] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
