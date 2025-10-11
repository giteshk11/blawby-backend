import type { FastifyRequest, FastifyReply } from 'fastify';
import { createOrGetAccount } from '@/modules/onboarding/services/connected-accounts.service';
import { createAccountRequestSchema } from '@/modules/onboarding/schemas/onboarding.schema';

type CreateAccountBody = {
  email: string;
  country?: string;
};

/**
 * Create or get connected account
 * POST /api/stripe/connected-accounts
 */
export default async function createConnectedAccountRoute(
  request: FastifyRequest<{ Body: CreateAccountBody }>,
  reply: FastifyReply,
) {
  // Validate request body
  const validatedData = createAccountRequestSchema.parse(request.body);

  const account = await createOrGetAccount(
    request.server,
    request.activeOrganizationId || '',
    validatedData.email,
  );

  return reply.send(account);
}

