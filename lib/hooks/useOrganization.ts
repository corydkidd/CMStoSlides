/**
 * React hook for accessing organization context
 */

import { useSession } from 'next-auth/react';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  outputType: 'pptx' | 'memo_pdf';
  hasClients: boolean;
  branding?: {
    company_name?: string;
    tagline?: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
  };
}

export interface OrganizationContext {
  organization: Organization | null;
  organizationId: string | null;
  role: 'admin' | 'member';
  isAdmin: boolean;
  isLoading: boolean;
}

/**
 * Hook to access current user's organization
 */
export function useOrganization(): OrganizationContext {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return {
      organization: null,
      organizationId: null,
      role: 'member',
      isAdmin: false,
      isLoading: true,
    };
  }

  if (!session?.user) {
    return {
      organization: null,
      organizationId: null,
      role: 'member',
      isAdmin: false,
      isLoading: false,
    };
  }

  const user = session.user as any;

  return {
    organization: user.organization || null,
    organizationId: user.organizationId || null,
    role: user.role || 'member',
    isAdmin: user.isAdmin || false,
    isLoading: false,
  };
}

/**
 * Hook to check if organization has specific features
 */
export function useOrganizationFeatures() {
  const { organization } = useOrganization();

  return {
    hasClients: organization?.hasClients || false,
    isPptxOrg: organization?.outputType === 'pptx',
    isMemoOrg: organization?.outputType === 'memo_pdf',
    branding: organization?.branding,
  };
}
