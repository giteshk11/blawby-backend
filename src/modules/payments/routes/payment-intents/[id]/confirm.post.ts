import type { FastifyRequest, FastifyReply } from 'fastify';
import { createPaymentsService } from '@/modules/payments/services/payments.service';
import { z } from 'zod';

// Request validation schema
const confirmPaymentSchema = z.object({
  paymentMethodId: z.string().optional(),
});

type ConfirmPaymentRequest = FastifyRequest<{
  Params: {
    id: string;
  };
  Body: z.infer<typeof confirmPaymentSchema>;
}>;

/**
 * Confirm a payment intent
 * POST /api/payment-intents/:id/confirm
 */
export default async function confirmPaymentRoute(
  request: ConfirmPaymentRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    // Validate request body
    const validatedData = confirmPaymentSchema.parse(request.body);

    // Get organization ID from request
    const organizationId = request.activeOrganizationId;
    if (!organizationId) {
      return reply.unauthorized('Organization ID is required');
    }

    // Create payments service
    const paymentsService = createPaymentsService(request.server);

    // Confirm payment
    const result = await paymentsService.confirmPayment({
      paymentIntentId: request.params.id,
      organizationId,
      paymentMethodId: validatedData.paymentMethodId,
    });

    if (!result.success) {
      if (result.error === 'Payment intent not found') {
        return reply.notFound('Payment intent not found');
      }
      return reply.badRequest(result.error || 'Failed to confirm payment');
    }

    return reply.send({
      success: true,
      data: result.paymentIntent,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.badRequest({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    request.server.logError(error, request);
    return reply.internalServerError('Failed to confirm payment');
  }
}
