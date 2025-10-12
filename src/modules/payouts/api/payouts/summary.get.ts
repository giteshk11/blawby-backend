import type { FastifyRequest, FastifyReply } from 'fastify';
import { createPayoutsService } from '../../services/payouts.service';

/**
 * Get payout summary for organization
 * GET /api/payouts/summary
 */
export default async function getPayoutSummaryRoute(
  request: FastifyRequest,
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

    // Get payout summary
    const result = await payoutsService.getPayoutSummary({
      organizationId,
    });

    if (!result.success) {
      return reply.badRequest(result.error || 'Failed to get payout summary');
    }

    return reply.send({
      success: true,
      data: result.summary,
    });
  } catch (error) {
    request.server.logError(error, request);
    return reply.internalServerError('Failed to get payout summary');
  }
}
