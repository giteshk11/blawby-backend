import { FastifyRequest, FastifyReply } from 'fastify';
import {
  verifyAndStore,
  processWebhookAsync,
} from '@/modules/onboarding/services/webhooks.service';

// POST /api/onboarding/webhooks/stripe
export default async function stripeWebhookRoute(
  request: FastifyRequest<{
    Body: any;
  }>,
  reply: FastifyReply,
) {
  // Get stripe-signature header
  const signature = request.headers['stripe-signature'] as string;

  if (!signature) {
    return reply.badRequest('Missing stripe-signature header');
  }

  try {
    // Get raw body for signature verification
    const rawBody = request.rawBody || JSON.stringify(request.body);

    // Verify and store webhook event
    const { event, alreadyProcessed } = await verifyAndStore(
      request.server,
      rawBody,
      signature,
      request.headers as Record<string, string>,
      request.url,
    );

    if (alreadyProcessed) {
      return reply.send({ received: true, alreadyProcessed: true });
    }

    // Process webhook asynchronously
    await processWebhookAsync(request.server, event.id);

    return reply.send({ received: true });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    request.server.log.error(
      {
        error: errorMessage,
        signature: signature.substring(0, 20) + '...', // Log partial signature for debugging
      },
      'Webhook verification failed',
    );

    if (errorMessage === 'Invalid signature') {
      return reply.badRequest('Invalid signature');
    }

    return reply.internalServerError('Webhook processing failed');
  }
}
