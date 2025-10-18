import type { FastifyRequest, FastifyReply } from 'fastify';
import { createPaymentsSession } from '@/modules/onboarding/services/connected-accounts.service';

type CreateSessionBody = {
  accountId: string;
};

/**
 * Create payments session
 * POST /api/onboarding/connected-accounts/payments-session
 */
export default async function createPaymentsSessionRoute(
  request: FastifyRequest<{ Body: CreateSessionBody }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { accountId } = request.body;

  if (!accountId) {
    return reply.badRequest('Account ID is required');
  }

  try {
    const session = await createPaymentsSession(request.server, accountId);

    return reply.send(session);
  } catch (error) {
    request.server.log.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        accountId,
      },
      'Failed to create payments session',
    );

    return reply.internalServerError('Failed to create payments session');
  }
}
