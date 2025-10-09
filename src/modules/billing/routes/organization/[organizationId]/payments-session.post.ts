import { FastifyRequest, FastifyReply } from 'fastify';
import { createPaymentsSession } from '@/modules/billing/services/billing.service';

type CreatePaymentsSessionRequest = {
  Params: {
    organizationId: string;
  };
};

/**
 * Create payments session for organization
 * POST /api/billing/organization/:organizationId/payments-session
 */
export default async function createPaymentsSessionRoute(
  request: FastifyRequest<CreatePaymentsSessionRequest>,
  reply: FastifyReply,
) {
  const session = await createPaymentsSession(
    { organizationId: request.params.organizationId },
    request.user,
  );

  return reply.send({ data: session });
}

export const config = {};
