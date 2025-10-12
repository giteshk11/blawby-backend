import { FastifyRequest, FastifyReply } from 'fastify';
import { getOnboardingStatus } from '@/modules/onboarding/services/connected-accounts.service';

type GetOnboardingStatusRequest = {
  Params: {
    organizationId: string;
  };
};

/**
 * Get onboarding status for organization
 * GET /api/onboarding/organization/:organizationId/onboarding-status
 */
export default async function getOnboardingStatusRoute(
  request: FastifyRequest<GetOnboardingStatusRequest>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const status = await getOnboardingStatus(
    request.params.organizationId,
    request.user,
  );

  return reply.send({ data: status });
}

export const config = {};
