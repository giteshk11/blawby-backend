import type { FastifyRequest, FastifyReply } from 'fastify';
import { createOnboardingSession } from '@/modules/onboarding/services/connected-accounts.service';

type CreateSessionBody = {
  accountId: string;
};

/**
 * Create onboarding session
 * POST /api/stripe/connected-accounts/onboarding-session
 */
export default async function createOnboardingSessionRoute(
  request: FastifyRequest<{ Body: CreateSessionBody }>,
  reply: FastifyReply,
) {
  const { accountId } = request.body;

  const session = await createOnboardingSession(request.server, accountId);

  return reply.send(session);
}

