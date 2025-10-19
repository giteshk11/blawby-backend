import { FastifyRequest, FastifyReply } from 'fastify';
import { createLoginLink } from '@/modules/onboarding/services/connected-accounts.service';

type CreateLoginLinkRequest = {
  Params: {
    organizationId: string;
  };
};

/**
 * Create login link for organization Stripe dashboard
 * POST /api/onboarding/organization/:organizationId/login-link
 */
export default async function createLoginLinkRoute(
  request: FastifyRequest<CreateLoginLinkRequest>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const loginLink = await createLoginLink(request.params.organizationId);

  return reply.send({ data: loginLink });
}

export const config = {};
