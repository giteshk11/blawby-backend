import { FastifyRequest, FastifyReply } from 'fastify';
import { createSubscriptionService } from '@/modules/subscriptions/services/subscription.service';

type GetOrganizationSubscriptionRequest = FastifyRequest<{
  Params: {
    organizationId: string;
  };
}>;

/**
 * Get active subscription for organization
 * GET /api/organizations/:organizationId/subscription
 */
export default async function getOrganizationSubscriptionRoute(
  request: GetOrganizationSubscriptionRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    const { organizationId } = request.params;

    // Verify user has access to this organization
    const userOrgId = request.activeOrganizationId;
    if (userOrgId !== organizationId) {
      return reply.forbidden('Access denied to this organization');
    }

    // Create subscription service
    const subscriptionService = createSubscriptionService(request.server);

    // Get active subscription
    const subscription =
      await subscriptionService.getActiveSubscription(organizationId);

    if (!subscription) {
      return reply.send({
        success: true,
        data: null,
        message: 'No active subscription found',
      });
    }

    return reply.send({
      success: true,
      data: subscription,
    });
  } catch (error) {
    request.server.logError(error, request);
    return reply.internalServerError('Failed to get organization subscription');
  }
}
