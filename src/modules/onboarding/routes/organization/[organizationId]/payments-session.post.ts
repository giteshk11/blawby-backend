import { FastifyRequest, FastifyReply } from 'fastify';
import { createPaymentsSessionForOrganization } from '@/modules/onboarding/services/connected-accounts.service';

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
  const session = await createPaymentsSessionForOrganization(
    request.server,
    request.params.organizationId,
  );

  return reply.send({ data: session });
}

export const config = {};
