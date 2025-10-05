import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import Stripe from 'stripe';

/**
 * Stripe Webhook Plugin
 * Handles Stripe webhook events using the event-driven architecture
 */
export default fastifyPlugin(async (fastify: FastifyInstance) => {
  // POST /webhooks/stripe
  fastify.post(
    '/webhooks/stripe',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const signature = request.headers['stripe-signature'] as string;
        const payload =
          typeof request.body === 'string'
            ? request.body
            : JSON.stringify(request.body);

        if (!signature) {
          return reply
            .status(400)
            .send({ error: 'Missing stripe-signature header' });
        }

        // Verify webhook signature
        const event = Stripe.webhooks.constructEvent(
          payload,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET!,
        );

        // Process webhook event asynchronously using the events plugin
        fastify.stripeWebhookEvents
          .processEvent(event)
          .catch((error: unknown) => {
            console.error(
              '❌ [StripeWebhooks] Error processing webhook:',
              error,
            );
          });

        return { received: true };
      } catch (error) {
        console.error('❌ [StripeWebhooks] Webhook error:', error);
        return reply
          .status(400)
          .send({ error: 'Webhook signature verification failed' });
      }
    },
  );
});
