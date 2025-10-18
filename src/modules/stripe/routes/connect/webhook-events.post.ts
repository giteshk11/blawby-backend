import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAndStore } from '@/modules/onboarding/services/onboarding-webhooks.service';
import { getQueue } from '@/shared/queue/queue.manager';
import { QUEUE_NAMES } from '@/shared/queue/queue.config';

interface WebhookRequest extends FastifyRequest {
  rawBody?: Buffer;
}

// POST /api/stripe/connect/webhook-events
export default async function stripeConnectWebhookRoute(
  request: WebhookRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  // Get stripe-signature header
  const signature = request.headers['stripe-signature'] as string;

  if (!signature) {
    return reply.code(400).send({ error: 'Missing stripe-signature header' });
  }

  try {
    // Get raw body for signature verification
    const rawBody = request.rawBody || JSON.stringify(request.body);

    // Verify and store webhook event
    const { event, alreadyProcessed, webhookId } = await verifyAndStore(
      rawBody,
      signature,
      request.headers as Record<string, string>,
      request.url,
    );

    if (alreadyProcessed) {
      return reply.send({ received: true, alreadyProcessed: true });
    }

    // Add job to onboarding webhooks queue for background processing
    const webhookQueue = getQueue(QUEUE_NAMES.ONBOARDING_WEBHOOKS);
    void webhookQueue.add('process-webhook', {
      webhookId: webhookId!, // Database UUID
      eventId: event.id, // Stripe event ID
      eventType: event.type,
    });

    request.server.log.info(
      { eventId: event.id, eventType: event.type },
      'Webhook event stored and queued for processing',
    );

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
      return reply.code(400).send({ error: 'Invalid signature' });
    }

    return reply.code(500).send({ error: 'Webhook processing failed' });
  }
}
