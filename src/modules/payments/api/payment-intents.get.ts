import type { FastifyRequest, FastifyReply } from 'fastify';
import { createPaymentsService } from '@/modules/payments/services/payments.service';

/**
 * List payment intents for organization
 * GET /api/payment-intents
 */
export default async function listPaymentIntentsRoute(
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

    // Create payments service
    const paymentsService = createPaymentsService(request.server);

    // List payment intents
    const result = await paymentsService.listPaymentIntents(
      organizationId,
      limit,
      offset,
    );

    if (!result.success) {
      return reply.badRequest(result.error || 'Failed to list payment intents');
    }

    return reply.send({
      success: true,
      data: result.paymentIntents,
      pagination: {
        limit,
        offset,
        hasMore: result.paymentIntents!.length === limit,
      },
    });
  } catch (error) {
    request.server.logError(error, request);
    return reply.internalServerError('Failed to list payment intents');
  }
}
