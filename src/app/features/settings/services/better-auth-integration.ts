import { FastifyRequest } from 'fastify';
import { auth } from '@/auth';

// Infer Better Auth session type for proper TypeScript support
type Session = typeof auth.$Infer.Session;

/**
 * Get user ID from Better Auth session
 * This integrates with Better Auth's session management
 */
export const getUserId = async function getUserId(
  request: FastifyRequest,
): Promise<string> {
  try {
    // Use Better Auth's API to get session from headers
    const session: Session | null = await auth.api.getSession({
      headers: request.headers as Record<string, string>,
    });

    if (!session?.user?.id) {
      throw new Error('User not authenticated - no valid session found');
    }

    return session.user.id;
  } catch {
    throw new Error('User not authenticated - no valid session found');
  }
};

/**
 * Get organization ID from Better Auth session
 * This gets the active organization for the current user
 */
export const getActiveOrganizationId = async function getActiveOrganizationId(
  request: FastifyRequest,
): Promise<string | null> {
  try {
    // Use Better Auth's API to get session from headers
    const session: Session | null = await auth.api.getSession({
      headers: request.headers as Record<string, string>,
    });

    // Better Auth automatically handles organization access control
    // The activeOrganizationId is set in the session when user switches organizations
    return session?.session?.activeOrganizationId ?? null;
  } catch {
    return null;
  }
};

/**
 * Check if user has permission to access organization settings
 * This integrates with Better Auth's organization permissions
 */
export const canAccessOrganization = async function canAccessOrganization(
  request: FastifyRequest,
  organizationId: string,
): Promise<boolean> {
  try {
    // Validate user is authenticated
    await getUserId(request);
    const activeOrgId = await getActiveOrganizationId(request);

    // Better Auth automatically validates organization access through the session
    // If the user has an active organization in their session, they have access to it
    if (activeOrgId === organizationId) {
      return true;
    }

    // If no active organization or different organization, deny access
    // Better Auth handles the organization membership validation
    return false;
  } catch {
    return false;
  }
};

/**
 * Get user role in organization
 * This integrates with Better Auth's organization roles
 */
export const getUserRoleInOrganization =
  async function getUserRoleInOrganization(
    request: FastifyRequest,
    organizationId: string,
  ): Promise<string | null> {
    try {
      // Validate user is authenticated
      await getUserId(request);
      const activeOrgId = await getActiveOrganizationId(request);

      // Only return role if user is accessing their active organization
      if (activeOrgId === organizationId) {
        // Better Auth handles role management through the organization plugin
        // For now, return a default role - this would be enhanced with proper role checking
        return 'member';
      }

      return null;
    } catch {
      return null;
    }
  };
