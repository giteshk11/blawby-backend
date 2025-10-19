import { FastifyRequest, FastifyReply } from 'fastify';
import { getAccount } from '@/modules/onboarding/services/connected-accounts.service';

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
  const account = await getAccount(
    request.server,
    request.params.organizationId,
  );

  if (!account) {
    return reply.send({
      data: {
        hasAccount: false,
        isActive: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      },
    });
  }

  return reply.send({
    data: {
      hasAccount: true,
      isActive: account.status.isActive,
      accountId: account.accountId,
      chargesEnabled: account.status.chargesEnabled,
      payoutsEnabled: account.status.payoutsEnabled,
      detailsSubmitted: account.status.detailsSubmitted,
      requirements: account.requirements,
    },
  });
}

export const config = {};
