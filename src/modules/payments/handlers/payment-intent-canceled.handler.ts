/**
 * Payment Intent Canceled Webhook Handler
 *
 * Handles payment_intent.canceled webhook events from Stripe
 * Updates payment intent status and publishes events
 */

import type { FastifyInstance } from 'fastify';
import { paymentIntentsRepository } from '@/modules/payments/database/queries/payment-intents.repository';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';

export const handlePaymentIntentCanceled =
  async function handlePaymentIntentCanceled(
    fastify: FastifyInstance,
    event: BaseEvent,
  ): Promise<void> {
    try {
      const paymentIntentData = event.payload as {
        id: string;
        cancellation_reason?: string;
      };

      const paymentIntent =
        await paymentIntentsRepository.findByStripePaymentIntentId(
          paymentIntentData.id,
        );

      if (!paymentIntent) {
        fastify.log.warn(`Payment intent not found: ${paymentIntentData.id}`);
        return;
      }

      await paymentIntentsRepository.update(paymentIntent.id, {
        status: 'canceled',
        metadata: {
          ...paymentIntent.metadata,
          cancellationReason: paymentIntentData.cancellation_reason,
          canceledAt: new Date().toISOString(),
        },
      });

      await fastify.events.publish({
        eventType: 'BILLING_PAYMENT_CANCELED',
        eventVersion: '1.0.0',
        actorId: 'webhook-stripe',
        actorType: 'webhook',
        organizationId: event.organizationId,
        payload: {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          cancellationReason: paymentIntentData.cancellation_reason,
        },
        metadata: fastify.events.createMetadata('webhook'),
      });

      fastify.log.info(`Payment canceled: ${paymentIntent.id}`);
    } catch (error) {
      fastify.log.error({ error }, 'Failed to process payment_intent.canceled');
      throw error;
    }
  };
