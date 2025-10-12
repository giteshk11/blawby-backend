import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createPaymentSetupService } from '../services/payment-setup.service';
import { createSubscriptionService } from '../services/subscription.service';

const completeSetupSchema = z.object({
  paymentMethodId: z.string(),
  planName: z.string().default('starter'),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
});

type CompleteSetupRequest = FastifyRequest<{
  Body: z.infer<typeof completeSetupSchema>;
}>;

/**
 * Complete payment setup and create subscription
 * POST /api/subscriptions/complete-setup
 */
export default async function completeSetupRoute(
  request: CompleteSetupRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    // Validate request body
    const validatedData = completeSetupSchema.parse(request.body);

    // Get organization ID from authenticated user
    const organizationId = request.activeOrganizationId;
    if (!organizationId) {
      return reply.unauthorized('Organization ID is required');
    }

    // Create services
    const paymentSetupService = createPaymentSetupService(request.server);
    const subscriptionService = createSubscriptionService(request.server);

    // 1. Get organization to verify customer exists
    const org = await request.server.db.query.organizations.findFirst({
      where: (organizations, { eq }) => eq(organizations.id, organizationId),
    });

    if (!org?.stripeCustomerId) {
      return reply.badRequest('Organization does not have a platform customer');
    }

    // 2. Attach payment method
    const attachResult = await paymentSetupService.attachPaymentMethod({
      organizationId,
      paymentMethodId: validatedData.paymentMethodId,
      customerId: org.stripeCustomerId,
    });

    if (!attachResult.success) {
      return reply.badRequest(
        attachResult.error || 'Failed to attach payment method',
      );
    }

    // 3. Create subscription
    const subscriptionResult =
      await subscriptionService.createSubscriptionForOrganization({
        organizationId,
        planName: validatedData.planName,
        billingCycle: validatedData.billingCycle,
      });

    if (!subscriptionResult.success) {
      return reply.badRequest(
        subscriptionResult.error || 'Failed to create subscription',
      );
    }

    return reply.send({
      success: true,
      data: {
        subscription: subscriptionResult.subscription,
        message: 'Payment setup completed and subscription created',
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
    return reply.internalServerError('Failed to complete setup');
  }
}
