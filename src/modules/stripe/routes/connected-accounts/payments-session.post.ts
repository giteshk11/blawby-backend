import type { FastifyRequest, FastifyReply } from 'fastify';
import { createPaymentsSession } from '@/modules/onboarding/services/connected-accounts.service';

type CreateSessionBody = {
  accountId: string;
};

/**
 * Create payments session
 * POST /api/stripe/connected-accounts/payments-session
 */
export default async function createPaymentsSessionRoute(
  request: FastifyRequest<{ Body: CreateSessionBody }>,
  reply: FastifyReply,
) {
  const { accountId } = request.body;

  const session = await createPaymentsSession(request.server, accountId);

  return reply.send(session);
}

