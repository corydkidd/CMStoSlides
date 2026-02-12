import { NextAuthOptions } from 'next-auth';
import { prisma } from './db';

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: 'authentik',
      name: 'Sumis Partners',
      type: 'oauth',
      clientId: process.env.AUTHENTIK_CLIENT_ID!,
      clientSecret: process.env.AUTHENTIK_CLIENT_SECRET!,
      authorization: {
        url: 'https://auth.sumispartners.com/application/o/authorize/',
        params: { scope: 'openid email profile groups' },
      },
      token: 'https://auth.sumispartners.com/application/o/token/',
      userinfo: 'https://auth.sumispartners.com/application/o/userinfo/',
      issuer: process.env.AUTHENTIK_ISSUER!,
      jwks_endpoint: 'https://auth.sumispartners.com/application/o/sumis-partners/jwks/',
      checks: ['pkce', 'state'],
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name || profile.preferred_username,
          email: profile.email,
          image: profile.picture,
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // Initial sign in
      if (account && profile) {
        token.groups = (profile as any).groups || [];
        token.authentikId = profile.sub;
      }
      // Subsequent requests
      if (user) {
        token.id = user.id;
      }

      // Fetch organization data on each token refresh
      if (token.authentikId) {
        const dbUser = await prisma.user.findUnique({
          where: { authentikId: token.authentikId as string },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                outputType: true,
                hasClients: true,
                branding: true,
              },
            },
          },
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.isAdmin = dbUser.isAdmin;
          token.organizationId = dbUser.organizationId;
          token.role = dbUser.role;
          token.organization = dbUser.organization;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId || token.id || token.sub;
        (session.user as any).groups = token.groups || [];
        (session.user as any).authentikId = token.authentikId || token.sub;
        (session.user as any).isAdmin = token.isAdmin || false;
        (session.user as any).organizationId = token.organizationId;
        (session.user as any).role = token.role || 'member';
        (session.user as any).organization = token.organization;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // On first sign in, create or update user in database
      if (account && profile && user.email) {
        const authentikId = profile.sub!;

        let dbUser = await prisma.user.findUnique({
          where: { authentikId },
        });

        if (!dbUser) {
          // Create new user
          dbUser = await prisma.user.create({
            data: {
              email: user.email,
              name: user.name,
              profileImage: user.image,
              authentikId,
            },
          });
        } else {
          // Update existing user
          await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              name: user.name,
              profileImage: user.image,
            },
          });
        }

        // Store the DB user id for token
        user.id = dbUser.id;
      }
      return true;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};
