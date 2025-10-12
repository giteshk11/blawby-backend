/**
 * Payment Intent Failed Webhook Handler
 *
 * Handles payment_intent.payment_failed webhook events from Stripe
 * Processes failed payment attempts
 */

import type { FastifyInstance } from 'fastify';
import { paymentIntentsRepository } from '@/modules/payments/database/queries/payment-intents.repository';
import { connectedAccountsRepository } from '@/modules/onboarding/database/queries/connected-accounts.repository';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';

export const handlePaymentIntentFailed =
  async function handlePaymentIntentFailed(
    fastify: FastifyInstance,
    event: BaseEvent,
  ): Promise<void> {
    try {
      const paymentIntentData = event.payload as {
        id: string;
        amount: number;
        currency: string;
        last_payment_error?: {
          message: string;
          code: string;
          type: string;
        };
        metadata?: Record<string, unknown>;
      };

      // 1. Find payment intent in database
      const paymentIntent =
        await paymentIntentsRepository.findByStripePaymentIntentId(
          paymentIntentData.id,
        );
      if (!paymentIntent) {
        fastify.log.warn(
          `Payment intent not found in database: ${paymentIntentData.id}`,
        );
        return;
      }

      // 2. Get connected account
      const connectedAccount = await connectedAccountsRepository.findById(
        paymentIntent.connectedAccountId,
      );
      if (!connectedAccount) {
        fastify.log.error(
          `Connected account not found for payment intent: ${paymentIntent.id}`,
        );
        return;
      }

      // 3. Update payment intent with failure details
      await paymentIntentsRepository.update(paymentIntent.id, {
        status: 'canceled', // Failed payments are marked as canceled
      });

      // 4. Publish events
      await fastify.events.publish({
        eventType: 'PAYMENTS_PAYMENT_FAILED',
        eventVersion: '1.0.0',
        actorId: connectedAccount.organizationId,
        actorType: 'system',
        organizationId: connectedAccount.organizationId,
        payload: {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntentData.amount,
          customerId: paymentIntent.customerId,
          error: paymentIntentData.last_payment_error,
        },
        metadata: fastify.events.createMetadata('webhook', {
          stripeEventId: event.eventId,
          eventType: 'payment_intent.payment_failed',
        }),
      });

      fastify.log.info(
        `Payment failed: ${paymentIntent.id} - $${paymentIntentData.amount / 100}`,
      );
    } catch (error) {
      fastify.log.error(
        { error, eventId: event.eventId },
        'Failed to process payment_intent.payment_failed webhook',
      );
      throw error;
    }
  };
