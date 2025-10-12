import type { FastifyRequest, FastifyReply } from 'fastify';
import { createPayoutsService } from '../../services/payouts.service';

type GetPayoutRequest = FastifyRequest<{
  Params: {
    id: string;
  };
}>;

/**
 * Get payout by ID
 * GET /api/payouts/:id
 */
export default async function getPayoutRoute(
  request: GetPayoutRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    // Get organization ID from request
    const organizationId = request.activeOrganizationId;
    if (!organizationId) {
      return reply.unauthorized('Organization ID is required');
    }

    // Create payouts service
    const payoutsService = createPayoutsService(request.server);

    // Get payout
    const result = await payoutsService.getPayout(
      request.params.id,
      organizationId,
    );

    if (!result.success) {
      if (result.error === 'Payout not found') {
        return reply.notFound('Payout not found');
      }
      return reply.badRequest(result.error || 'Failed to get payout');
    }

    return reply.send({
      success: true,
      data: result.payout,
    });
  } catch (error) {
    request.server.logError(error, request);
    return reply.internalServerError('Failed to get payout');
  }
}
