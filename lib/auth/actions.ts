'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Get the current authenticated user with their DB profile.
 * Returns null if not authenticated.
 */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const authentikId = (session.user as any).authentikId;
  if (!authentikId) return null;

  const dbUser = await prisma.user.findUnique({
    where: { authentikId },
  });

  if (!dbUser) return null;

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    profileImage: dbUser.profileImage,
    isAdmin: dbUser.isAdmin,
    isActive: dbUser.isActive,
    templatePath: dbUser.templatePath,
  };
}
