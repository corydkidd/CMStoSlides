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

  if (!dbUser) {
    redirect('/dashboard');
  }

  // Admin view: show all documents from all organizations
  const isAdmin = dbUser.isAdmin;

  let documents;
  let organizations;

  if (isAdmin) {
    // Fetch all organizations for admin
    organizations = await prisma.organization.findMany({
      include: {
        organizationAgencies: {
          include: {
            agency: true,
          },
        },
      },
    });

    // Fetch all documents with outputs from all organizations
    documents = await prisma.regulatoryDocument.findMany({
      include: {
        agency: true,
        documentOutputs: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                outputType: true,
              },
            },
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
      take: 100, // Show more for admin
    });
  } else {
    // Regular user view: show only their org's documents
    if (!dbUser.organization) {
      redirect('/dashboard');
    }

    organizations = [dbUser.organization];

    const agencyIds = dbUser.organization.organizationAgencies.map(oa => oa.agencyId);

    documents = await prisma.regulatoryDocument.findMany({
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
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                outputType: true,
              },
            },
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
  }

  return (
    <DocumentsPageClient
      documents={documents as any}
      organization={dbUser.organization}
      organizations={organizations as any}
      isAdmin={isAdmin}
    />
  );
}
