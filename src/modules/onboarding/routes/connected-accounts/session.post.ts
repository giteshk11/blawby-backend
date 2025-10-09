import { FastifyRequest, FastifyReply } from 'fastify';
import {
  getAccount,
  createOnboardingSession,
} from '@/modules/onboarding/services/connected-accounts.service';

// POST /api/onboarding/connected-accounts/session
export default async function createOnboardingSessionRoute(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Get organization ID from authenticated user
  const organizationId =
    request.user?.organization?.id || request.activeOrganizationId;

  if (!organizationId) {
    return reply.badRequest('Organization ID is required');
  }

  try {
    // Get account for organization
    const account = await getAccount(request.server, organizationId);

    if (!account) {
      return reply.notFound('Connected account not found');
    }

    // Create new onboarding session
    const session = await createOnboardingSession(
      request.server,
      account.accountId,
    );

    return reply.send(session);
  } catch (error) {
    request.server.log.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId,
      },
      'Failed to create onboarding session',
    );

    return reply.internalServerError('Failed to create onboarding session');
  }
}
