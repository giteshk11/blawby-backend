import { FastifyRequest, FastifyReply } from 'fastify';
import { getAccount } from '@/modules/onboarding/services/connected-accounts.service';

// GET /api/onboarding/connected-accounts
export default async function getConnectedAccountRoute(
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
    const account = await getAccount(request.server, organizationId);

    if (!account) {
      return reply.notFound('Connected account not found');
    }

    return reply.send(account);
  } catch (error) {
    request.server.log.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId,
      },
      'Failed to get connected account',
    );

    return reply.internalServerError('Failed to get connected account');
  }
}
