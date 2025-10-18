import type { FastifyRequest, FastifyReply } from 'fastify';
import { createOnboardingSession } from '@/modules/onboarding/services/connected-accounts.service';

type CreateSessionBody = {
  email: string;
  organizationId: string;
};

/**
 * Create onboarding session
 * POST /api/onboarding/connected-accounts/onboarding-session
 */
export default async function createOnboardingSessionRoute(
  request: FastifyRequest<{ Body: CreateSessionBody }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { email, organizationId } = request.body;

  if (!email || !organizationId) {
    return reply.badRequest('Email and Organization ID are required');
  }

  try {
    const session = await createOnboardingSession(
      request.server,
      email,
      organizationId,
    );

    return reply.send(session);
  } catch (error) {
    request.server.log.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        email,
        organizationId,
      },
      'Failed to create onboarding session',
    );

    return reply.internalServerError('Failed to create onboarding session');
  }
}
