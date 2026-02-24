import { NextAuthOptions } from 'next-auth';
import { prisma } from './db';

async function sendNotification(app: string, event: string, message: string) {
  const url = process.env.NOTIFY_URL;
  const secret = process.env.NOTIFY_SECRET;
  if (!url || !secret) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Notify-Secret': secret },
      body: JSON.stringify({ app, event, message }),
    });
  } catch (e) {
    console.error('[Notify] Failed to send notification:', e);
  }
}

export const authOptions: NextAuthOptions = {
  trustHost: true,
  providers: [
    {
      id: 'authentik',
      name: 'Advient Advisors',
      type: 'oauth',
      clientId: process.env.AUTHENTIK_CLIENT_ID!,
      clientSecret: process.env.AUTHENTIK_CLIENT_SECRET!,
      authorization: {
        url: 'https://auth.advientadvisors.com/application/o/authorize/',
        params: { scope: 'openid email profile groups' },
      },
      token: 'https://auth.advientadvisors.com/application/o/token/',
      userinfo: 'https://auth.advientadvisors.com/application/o/userinfo/',
      issuer: process.env.AUTHENTIK_ISSUER!,
      jwks_endpoint: 'https://auth.advientadvisors.com/application/o/regulatory-intel/jwks/',
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
      console.log('[Auth JWT] Callback triggered:', {
        hasAccount: !!account,
        hasProfile: !!profile,
        hasUser: !!user,
        profileSub: profile?.sub,
        profileEmail: profile?.email,
      });

      // Initial sign in
      if (account && profile) {
        token.groups = (profile as any).groups || [];
        token.authentikId = profile.sub;
        token.name = profile.name || (profile as any).preferred_username;
        token.email = profile.email;
        token.picture = (profile as any).picture;
        console.log('[Auth JWT] Set from profile:', { name: token.name, email: token.email });
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
          // Preserve user info from database
          token.name = dbUser.name;
          token.email = dbUser.email;
          token.picture = dbUser.profileImage;
          console.log('[Auth JWT] Set from DB:', {
            userId: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            organizationId: dbUser.organizationId,
          });
        } else {
          console.log('[Auth JWT] No DB user found for authentikId:', token.authentikId);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // Set user info from token
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.picture as string;
        // Set custom fields
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
      console.log('[Auth SignIn] Callback triggered:', {
        hasUser: !!user,
        hasAccount: !!account,
        hasProfile: !!profile,
        userEmail: user?.email,
        profileSub: profile?.sub,
      });

      // On first sign in, create or update user in database
      if (account && profile && user.email) {
        const authentikId = profile.sub!;
        console.log('[Auth SignIn] Creating/updating user with authentikId:', authentikId);

        let dbUser = await prisma.user.findUnique({
          where: { authentikId },
        });

        if (!dbUser) {
          console.log('[Auth SignIn] User not found, creating new user');

          // Determine organization based on email domain
          const emailDomain = user.email.split('@')[1].toLowerCase();
          let organizationId: string | null = null;
          let isAdmin = false;

          if (emailDomain === 'catalysthcc.com') {
            // Nancy and Catalyst team
            const catalyst = await prisma.organization.findUnique({
              where: { slug: 'catalyst' },
            });
            organizationId = catalyst?.id || null;
          } else if (emailDomain === 'healthpolicystrategiesllc.com') {
            // Jayson and Health Policy Strategies team
            const hps = await prisma.organization.findUnique({
              where: { slug: 'health-policy-strategies' },
            });
            organizationId = hps?.id || null;
          } else if (emailDomain === 'advientadvisors.com') {
            // Advient team members are admins
            isAdmin = true;
            // Default to Health Policy Strategies for Advient admins, but they can switch
            const hps = await prisma.organization.findUnique({
              where: { slug: 'health-policy-strategies' },
            });
            organizationId = hps?.id || null;
          }

          console.log('[Auth SignIn] Assigning organization:', { emailDomain, organizationId, isAdmin });

          // Create new user
          dbUser = await prisma.user.create({
            data: {
              email: user.email,
              name: user.name || user.email.split('@')[0],
              profileImage: user.image,
              authentikId,
              organizationId,
              isAdmin,
              role: isAdmin ? 'admin' : 'user',
            },
          });
          console.log('[Auth SignIn] Created user:', {
            id: dbUser.id,
            email: dbUser.email,
            organizationId: dbUser.organizationId,
            isAdmin: dbUser.isAdmin,
          });
        } else {
          // Update existing user's profile info
          await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              name: user.name || dbUser.name,
              profileImage: user.image,
            },
          });
        }

        // Notify on non-admin logins
        if (!dbUser.isAdmin) {
          await sendNotification(
            'Regulatory Intel',
            'User login',
            `${dbUser.name} (${dbUser.email}) logged in`
          );
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
