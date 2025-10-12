import { FastifyRequest, FastifyReply } from 'fastify';
import { createPaymentsSessionBilling } from '@/modules/onboarding/services/connected-accounts.service';

type CreatePaymentsSessionRequest = {
  Params: {
    organizationId: string;
  };
};

/**
 * Create payments session for organization
 * POST /api/onboarding/organization/:organizationId/payments-session
 */
export default async function createPaymentsSessionRoute(
  request: FastifyRequest<CreatePaymentsSessionRequest>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const session = await createPaymentsSessionBilling(
    { organizationId: request.params.organizationId },
    request.user,
    request.server,
  );

  return reply.send({ data: session });
}

export const config = {};
