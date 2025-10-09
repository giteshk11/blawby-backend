import { FastifyRequest, FastifyReply } from 'fastify';
import { getOnboardingStatus } from '@/modules/billing/services/billing.service';

type GetOnboardingStatusRequest = {
  Params: {
    organizationId: string;
  };
};

/**
 * Get onboarding status for organization
 * GET /api/billing/organization/:organizationId/onboarding-status
 */
export default async function getOnboardingStatusRoute(
  request: FastifyRequest<GetOnboardingStatusRequest>,
  reply: FastifyReply,
) {
  const status = await getOnboardingStatus(
    request.params.organizationId,
    request.user,
  );

  return reply.send({ data: status });
}

export const config = {
  
};
