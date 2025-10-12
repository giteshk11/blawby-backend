import type { FastifyRequest, FastifyReply } from 'fastify';
import { createPaymentsService } from '@/modules/payments/services/payments.service';
import { z } from 'zod';

// Request validation schema
const createPaymentIntentSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID').optional(),
  amount: z.number().int().min(50, 'Amount must be at least $0.50'), // Minimum $0.50
  currency: z.string().length(3).default('usd'),
  applicationFeeAmount: z.number().int().min(0).optional(),
  paymentMethodTypes: z.array(z.string()).default(['card']),
  customerEmail: z.string().email().optional(),
  customerName: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

type CreatePaymentIntentRequest = FastifyRequest<{
  Body: z.infer<typeof createPaymentIntentSchema>;
}>;

/**
 * Create a new payment intent
 * POST /api/payment-intents
 */
export default async function createPaymentIntentRoute(
  request: CreatePaymentIntentRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    // Validate request body
    const validatedData = createPaymentIntentSchema.parse(request.body);

    // Get organization ID from request
    const organizationId = request.activeOrganizationId;
    if (!organizationId) {
      return reply.unauthorized('Organization ID is required');
    }

    // Create payments service
    const paymentsService = createPaymentsService(request.server);

    // Create payment intent
    const result = await paymentsService.createPaymentIntent({
      organizationId,
      customerId: validatedData.customerId,
      amount: validatedData.amount,
      currency: validatedData.currency,
      applicationFeeAmount: validatedData.applicationFeeAmount,
      paymentMethodTypes: validatedData.paymentMethodTypes,
      customerEmail: validatedData.customerEmail,
      customerName: validatedData.customerName,
      description: validatedData.description,
      metadata: validatedData.metadata,
    });

    if (!result.success) {
      return reply.badRequest(
        result.error || 'Failed to create payment intent',
      );
    }

    return reply.status(201).send({
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
    return reply.internalServerError('Failed to create payment intent');
  }
}
