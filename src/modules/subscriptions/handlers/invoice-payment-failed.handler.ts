/**
 * Invoice Payment Failed Webhook Handler
 *
 * Handles invoice.payment_failed webhook events from Stripe
 * Updates subscription to past_due and logs failure
 */

import type { FastifyInstance } from 'fastify';
import { subscriptions, subscriptionEvents } from '../database/schema';
import { eq } from 'drizzle-orm';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';

export const handleInvoicePaymentFailed =
  async function handleInvoicePaymentFailed(
    fastify: FastifyInstance,
    event: BaseEvent,
  ): Promise<void> {
    try {
      const invoiceData = event.payload as {
        id: string;
        subscription?: string;
        amount_due: number;
        currency: string;
        customer: string;
        attempt_count: number;
        next_payment_attempt?: number;
        last_finalization_error?: {
          message: string;
          type: string;
        };
      };

      // 1. Find subscription by Stripe subscription ID
      const subscription = await fastify.db.query.subscriptions.findFirst({
        where: eq(
          subscriptions.stripeSubscriptionId,
          invoiceData.subscription!,
        ),
      });

      if (!subscription) {
        fastify.log.warn(
          `Subscription not found for invoice: ${invoiceData.id}`,
        );
        return;
      }

      // 2. Update subscription to past_due status
      await fastify.db
        .update(subscriptions)
        .set({
          status: 'past_due',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscription.id));

      // 3. Log payment failure event
      await fastify.db.insert(subscriptionEvents).values({
        subscriptionId: subscription.id,
        eventType: 'payment_failed',
        fromStatus: 'active',
        toStatus: 'past_due',
        triggeredByType: 'webhook',
        errorMessage: invoiceData.last_finalization_error?.message,
        metadata: {
          invoiceId: invoiceData.id,
          amountDue: invoiceData.amount_due,
          currency: invoiceData.currency,
          attemptCount: invoiceData.attempt_count,
          nextPaymentAttempt: invoiceData.next_payment_attempt
            ? new Date(invoiceData.next_payment_attempt * 1000).toISOString()
            : null,
          lastError: invoiceData.last_finalization_error,
        },
      });

      // 4. Publish event for notification sending
      await fastify.events.publish({
        eventType: 'SUBSCRIPTION_PAYMENT_FAILED',
        eventVersion: '1.0.0',
        actorId: subscription.organizationId,
        actorType: 'system',
        organizationId: subscription.organizationId,
        payload: {
          subscriptionId: subscription.id,
          invoiceId: invoiceData.id,
          amountDue: invoiceData.amount_due,
          attemptCount: invoiceData.attempt_count,
          nextPaymentAttempt: invoiceData.next_payment_attempt,
          errorMessage: invoiceData.last_finalization_error?.message,
        },
        metadata: fastify.events.createMetadata('webhook', {
          stripeEventId: event.eventId,
          eventType: 'invoice.payment_failed',
        }),
      });

      fastify.log.warn(
        `Payment failed for subscription: ${subscription.id} - $${invoiceData.amount_due / 100} (attempt ${invoiceData.attempt_count})`,
      );
    } catch (error) {
      fastify.log.error(
        { error, eventId: event.eventId },
        'Failed to process invoice.payment_failed webhook',
      );
      throw error;
    }
  };
