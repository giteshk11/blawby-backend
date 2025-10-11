import type { FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';
import { getStripeClient } from '@/modules/billing/services/stripe-client.service';
import {
  existsByStripeEventId,
  createStripeWebhookEvent,
} from '@/modules/stripe/repositories/stripe-webhook-events.repository';
import { webhookResponseSchema } from '@/modules/stripe/schemas/webhook-events.schema';

/**
 * Stripe webhook handler with BullMQ queue
 * POST /api/stripe/webhooks
 */
export default async function webhookRoute(fastify: FastifyRequest['server']) {
  fastify.post(
    '/webhooks',
    {
      // Webhooks do not require authentication
      schema: {
        response: {
          200: webhookResponseSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers['stripe-signature'];
      const rawBody = request.body;

      if (!signature || !rawBody) {
        return reply.badRequest('Missing stripe-signature header or raw body');
      }

      try {
        // Verify signature using Stripe SDK
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
          throw new Error(
            'STRIPE_WEBHOOK_SECRET environment variable is required',
          );
        }

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

        // Queue job for async processing
        await request.server.queue.addWebhookJob(
          webhookEvent.id,
          event.id,
          event.type,
        );

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
    },
  );
}
