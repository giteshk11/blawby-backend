import type { FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';
import { getStripeClient } from '@/shared/services/stripe-client.service';
import {
  existsByStripeEventId,
  createStripeWebhookEvent,
} from '@/modules/stripe/repositories/stripe-webhook-events.repository';
import { webhookResponseSchema } from '@/modules/stripe/schemas/webhook-events.schema';

// Define a custom request type with rawBody
interface WebhookRequest extends FastifyRequest {
  rawBody?: Buffer;
}

export default async function webhookRoute(
  request: WebhookRequest,
  reply: FastifyReply,
) {
  const signature = request.headers['stripe-signature'];
  const rawBody = request.rawBody; // Provided by our raw-body plugin

  if (!signature || !rawBody) {
    return reply.badRequest('Missing stripe-signature header or raw body');
  }

  try {
    // Verify signature using Stripe SDK
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
    }

    // Debug logging for webhook verification
    request.server.log.info(
      {
        context: {
          component: 'WebhookRoute',
          operation: 'verifySignature',
          signatureLength: signature?.length,
          rawBodyType: typeof rawBody,
          rawBodyLength: rawBody?.length,
          rawBodyIsBuffer: rawBody instanceof Buffer,
          webhookSecretExists: !!webhookSecret,
          webhookSecretPrefix: webhookSecret?.substring(0, 10),
        },
      },
      'Attempting webhook signature verification',
    );

    const event = getStripeClient().webhooks.constructEvent(
      rawBody as string | Buffer,
      signature as string,
      webhookSecret,
    );

    // Check idempotency
    const alreadyExists = await existsByStripeEventId(
      request.server.db,
      event.id,
    );

    if (alreadyExists) {
      const response = webhookResponseSchema.parse({
        received: true,
        duplicate: true,
      });
      return reply.send(response);
    }

    // Save webhook to database
    const webhookEvent = await createStripeWebhookEvent(
      request.server.db,
      event,
      request.headers as Record<string, string>,
      request.url,
    );

    // Queue job for async processing (if queue is available)
    if (request.server.queue) {
      await request.server.queue.addWebhookJob(
        webhookEvent.id,
        event.id,
        event.type,
      );
    } else {
      request.server.log.warn(
        'Queue not available - webhook will not be processed asynchronously',
      );
    }

    const response = webhookResponseSchema.parse({
      received: true,
    });

    return reply.send(response);
  } catch (error) {
    request.server.log.error(
      {
        error,
        signature:
          typeof signature === 'string'
            ? signature.substring(0, 20)
            : 'unknown',
      },
      'Webhook verification failed',
    );

    // Only return 400 for signature verification errors
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return reply.badRequest('Invalid signature');
    }

    // For other errors, still return 200 to prevent Stripe retries
    // The webhook will be processed by the worker when it's fixed
    return reply.send({ received: true });
  }
}
