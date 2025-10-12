import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createPaymentSetupService } from '../services/payment-setup.service';

const setupPaymentSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

type SetupPaymentRequest = FastifyRequest<{
  Body: z.infer<typeof setupPaymentSchema>;
}>;

/**
 * Setup payment method for subscription billing
 * POST /api/subscriptions/setup-payment
 */
export default async function setupPaymentRoute(
  request: SetupPaymentRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    // Validate request body
    const validatedData = setupPaymentSchema.parse(request.body);

    // Get organization ID from authenticated user
    const organizationId = request.activeOrganizationId;
    if (!organizationId) {
      return reply.unauthorized('Organization ID is required');
    }

    // Create payment setup service
    const paymentSetupService = createPaymentSetupService(request.server);

    // 1. Create platform customer
    const customerResult = await paymentSetupService.createPlatformCustomer({
      organizationId,
      email: validatedData.email,
      name: validatedData.name,
    });

    if (!customerResult.success) {
      return reply.badRequest(
        customerResult.error || 'Failed to create platform customer',
      );
    }

    // 2. Create setup intent
    const setupIntentResult = await paymentSetupService.createSetupIntent({
      customerId: customerResult.customerId!,
      organizationId,
    });

    if (!setupIntentResult.success) {
      return reply.badRequest(
        setupIntentResult.error || 'Failed to create setup intent',
      );
    }

    return reply.send({
      success: true,
      data: {
        clientSecret: setupIntentResult.clientSecret,
        customerId: customerResult.customerId,
      },
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
    return reply.internalServerError('Failed to setup payment');
  }
}
