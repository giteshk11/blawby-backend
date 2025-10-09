import { FastifyRequest, FastifyReply } from 'fastify';
import { createOrGetAccount } from '@/modules/onboarding/services/connected-accounts.service';
import { createAccountRequestSchema } from '@/modules/onboarding/schemas/onboarding.schema';

// POST /api/onboarding/connected-accounts
export default async function createConnectedAccountRoute(
  request: FastifyRequest<{
    Body: {
      email: string;
      country?: string;
    };
  }>,
  reply: FastifyReply,
) {
  // Validate request body
  const body = createAccountRequestSchema.parse(request.body);

  // Get organization ID from authenticated user
  const organizationId =
    request.user?.organization?.id || request.activeOrganizationId;

  if (!organizationId) {
    return reply.badRequest('Organization ID is required');
  }

  try {
    const result = await createOrGetAccount(
      request.server,
      organizationId,
      body.email,
    );

    return reply.send(result);
  } catch (error) {
    request.server.log.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId,
        email: body.email,
      },
      'Failed to create connected account',
    );

    return reply.internalServerError('Failed to create connected account');
  }
}
