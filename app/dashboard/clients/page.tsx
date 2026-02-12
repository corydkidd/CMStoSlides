import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ClientsPageClient } from './ClientsPageClient';

export default async function ClientsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const user = session.user as any;

  // Get user from database with organization
  const dbUser = await prisma.user.findUnique({
    where: { authentikId: user.authentikId },
    include: {
      organization: true,
    },
  });

  if (!dbUser || !dbUser.organization) {
    redirect('/dashboard');
  }

  // Check if organization has clients feature
  if (!dbUser.organization.hasClients) {
    redirect('/dashboard');
  }

  // Fetch clients
  const clients = await prisma.client.findMany({
    where: {
      organizationId: dbUser.organizationId!,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return (
    <ClientsPageClient
      clients={clients}
      organization={dbUser.organization}
    />
  );
}
