/**
 * Payment Intent Succeeded Webhook Handler
 *
 * Handles payment_intent.succeeded webhook events from Stripe
 * Processes successful direct payments
 */

import type { FastifyInstance } from 'fastify';
import { paymentIntentsRepository } from '../database/queries/payment-intents.repository';
import { connectedAccountsRepository } from '@/modules/onboarding/database/queries/connected-accounts.repository';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';

export const handlePaymentIntentSucceeded =
  async function handlePaymentIntentSucceeded(
    fastify: FastifyInstance,
    event: BaseEvent,
  ): Promise<void> {
    try {
      const paymentIntentData = event.payload as {
        id: string;
        amount: number;
        currency: string;
        payment_method?: string;
        charges?: {
          data: Array<{
            id: string;
            receipt_url?: string;
          }>;
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

      // 3. Update payment intent with success details
      const charge = paymentIntentData.charges?.data[0];
      await paymentIntentsRepository.update(paymentIntent.id, {
        status: 'succeeded',
        paymentMethodId: paymentIntentData.payment_method,
        stripeChargeId: charge?.id,
        receiptUrl: charge?.receipt_url,
        succeededAt: new Date(),
      });

      // 4. Publish events
      await fastify.events.publish({
        eventType: 'BILLING_PAYMENT_SUCCEEDED',
        eventVersion: '1.0.0',
        actorId: connectedAccount.organizationId,
        actorType: 'system',
        organizationId: connectedAccount.organizationId,
        payload: {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntentData.amount,
          applicationFeeAmount: paymentIntent.applicationFeeAmount,
          customerId: paymentIntent.customerId,
          receiptUrl: charge?.receipt_url,
        },
        metadata: fastify.events.createMetadata('webhook', {
          stripeEventId: event.eventId,
          eventType: 'payment_intent.succeeded',
        }),
      });

      // 5. Send receipt if email provided
      if (paymentIntent.receiptEmail && charge?.receipt_url) {
        // TODO: Implement receipt email sending
        fastify.log.info(`Receipt sent to: ${paymentIntent.receiptEmail}`);
      }

      fastify.log.info(
        `Payment succeeded: ${paymentIntent.id} - $${paymentIntentData.amount / 100}`,
      );
    } catch (error) {
      fastify.log.error(
        { error, eventId: event.eventId },
        'Failed to process payment_intent.succeeded webhook',
      );
      throw error;
    }
  };
