import type { FastifyRequest, FastifyReply } from 'fastify';
import { createPayoutsService } from '../services/payouts.service';

/**
 * List payouts for organization
 * GET /api/payouts
 */
export default async function listPayoutsRoute(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    // Get organization ID from request
    const organizationId = request.activeOrganizationId;
    if (!organizationId) {
      return reply.unauthorized('Organization ID is required');
    }

    // Get query parameters
    const limit = Math.min(Number(request.query.limit) || 50, 100);
    const offset = Number(request.query.offset) || 0;

    // Create payouts service
    const payoutsService = createPayoutsService(request.server);

    // Get payouts
    const result = await payoutsService.getPayouts({
      organizationId,
      limit,
      offset,
    });

    if (!result.success) {
      return reply.badRequest(result.error || 'Failed to get payouts');
    }

    return reply.send({
      success: true,
      data: result.payouts,
      summary: result.summary,
      pagination: {
        limit,
        offset,
        hasMore: result.payouts!.length === limit,
      },
    });
  } catch (error) {
    request.server.logError(error, request);
    return reply.internalServerError('Failed to get payouts');
  }
}
