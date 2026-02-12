import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DocumentsPageClient } from './DocumentsPageClient';

export default async function DocumentsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const user = session.user as any;

  // Get user from database with organization
  const dbUser = await prisma.user.findUnique({
    where: { authentikId: user.authentikId },
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

  if (!dbUser || !dbUser.organization) {
    redirect('/dashboard');
  }

  // Get agency IDs this org is subscribed to
  const agencyIds = dbUser.organization.organizationAgencies.map(oa => oa.agencyId);

  // Fetch recent regulatory documents
  const documents = await prisma.regulatoryDocument.findMany({
    where: {
      agencyId: { in: agencyIds },
    },
    include: {
      agency: true,
      documentOutputs: {
        where: {
          organizationId: dbUser.organizationId!,
        },
        include: {
          clientOutputs: {
            where: {
              selectedForGeneration: true,
            },
            include: {
              client: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      publicationDate: 'desc',
    },
    take: 50,
  });

  return (
    <DocumentsPageClient
      documents={documents as any}
      organization={dbUser.organization}
    />
  );
}
