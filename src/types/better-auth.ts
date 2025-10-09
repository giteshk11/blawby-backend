// src/types/better-auth.ts
import type { FastifyInstance } from 'fastify';

/**
 * Better Auth Type Definitions
 *
 * Uses Better Auth's $Infer pattern for proper type inference
 * Based on the Better Auth TypeScript documentation
 */

// Infer Better Auth instance type from Fastify
type BetterAuthInstance = FastifyInstance['betterAuth'];

// ============================================================================
// ORGANIZATION API TYPES
// ============================================================================

/**
 * Organization API request types inferred from Better Auth
 */
export type CreateOrganizationRequest = Parameters<
  BetterAuthInstance['api']['createOrganization']
>[0]['body'];
export type UpdateOrganizationRequest = Parameters<
  BetterAuthInstance['api']['updateOrganization']
>[0]['body'];
export type SetActiveOrganizationRequest = Parameters<
  BetterAuthInstance['api']['setActiveOrganization']
>[0]['body'];
export type CheckOrganizationSlugRequest = Parameters<
  BetterAuthInstance['api']['checkOrganizationSlug']
>[0]['body'];
export type CheckOrganizationSlugResponse = Awaited<
  ReturnType<BetterAuthInstance['api']['checkOrganizationSlug']>
>;
export type GetFullOrganizationRequest = Parameters<
  BetterAuthInstance['api']['getFullOrganization']
>[0]['query'];
export type DeleteOrganizationRequest = Parameters<
  BetterAuthInstance['api']['deleteOrganization']
>[0]['body'];

// ============================================================================
// SESSION & USER API TYPES
// ============================================================================

export type GetSessionRequest = Parameters<
  BetterAuthInstance['api']['getSession']
>[0]['headers'];

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Headers type for Better Auth API calls
 */
export type BetterAuthHeaders = Record<string, string>;

/**
 * Better Auth error type
 */
export type BetterAuthError = Error & {
  status?: number;
  code?: string;
  message?: string;
};
