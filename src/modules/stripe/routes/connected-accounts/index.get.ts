import type { FastifyRequest, FastifyReply } from 'fastify';
import { getAccount } from '@/modules/onboarding/services/connected-accounts.service';

/**
 * Get connected account details
 * GET /api/stripe/connected-accounts
 */
export default async function getConnectedAccountRoute(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const account = await getAccount(
    request.server,
    request.activeOrganizationId || '',
  );

  if (!account) {
    return reply.notFound('Connected account not found');
  }

  return reply.send(account);
}

