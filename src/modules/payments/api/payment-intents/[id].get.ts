import type { FastifyRequest, FastifyReply } from 'fastify';
import { createPaymentsService } from '@/modules/payments/services/payments.service';

type GetPaymentIntentRequest = FastifyRequest<{
  Params: {
    id: string;
  };
}>;

/**
 * Get payment intent by ID
 * GET /api/payment-intents/:id
 */
export default async function getPaymentIntentRoute(
  request: GetPaymentIntentRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    // Get organization ID from request
    const organizationId = request.activeOrganizationId;
    if (!organizationId) {
      return reply.unauthorized('Organization ID is required');
    }

    // Create payments service
    const paymentsService = createPaymentsService(request.server);

    // Get payment intent
    const result = await paymentsService.getPaymentIntent(
      request.params.id,
      organizationId,
    );

    if (!result.success) {
      if (result.error === 'Payment intent not found') {
        return reply.notFound('Payment intent not found');
      }
      return reply.badRequest(result.error || 'Failed to get payment intent');
    }

    return reply.send({
      success: true,
      data: result.paymentIntent,
    });
  } catch (error) {
    request.server.logError(error, request);
    return reply.internalServerError('Failed to get payment intent');
  }
}
