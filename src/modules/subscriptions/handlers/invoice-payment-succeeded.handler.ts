/**
 * Invoice Payment Succeeded Webhook Handler
 *
 * Handles invoice.payment_succeeded webhook events from Stripe
 * Updates subscription to active and extends current period
 */

import type { FastifyInstance } from 'fastify';
import { subscriptions, subscriptionEvents } from '../database/schema';
import { eq } from 'drizzle-orm';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';
import { db } from '@/database';

export const handleInvoicePaymentSucceeded =
  async function handleInvoicePaymentSucceeded(
    fastify: FastifyInstance,
    event: BaseEvent,
  ): Promise<void> {
    try {
      const invoiceData = event.payload as {
        id: string;
        subscription?: string;
        amount_paid: number;
        currency: string;
        customer: string;
        hosted_invoice_url?: string;
        invoice_pdf?: string;
      };

      // 1. Find subscription by Stripe subscription ID
      const subscriptionResults = await db
        .select()
        .from(subscriptions)
        .where(
          eq(subscriptions.stripeSubscriptionId, invoiceData.subscription!),
        )
        .limit(1);

      const subscription = subscriptionResults[0];

      if (!subscription) {
        fastify.log.warn(
          `Subscription not found for invoice: ${invoiceData.id}`,
        );
        return;
      }

      // 2. Update subscription to active status
      await fastify.db
        .update(subscriptions)
        .set({
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscription.id));

      // 3. Log payment success event
      await fastify.db.insert(subscriptionEvents).values({
        subscriptionId: subscription.id,
        eventType: 'payment_succeeded',
        toStatus: 'active',
        triggeredByType: 'webhook',
        metadata: {
          invoiceId: invoiceData.id,
          amountPaid: invoiceData.amount_paid,
          currency: invoiceData.currency,
          hostedInvoiceUrl: invoiceData.hosted_invoice_url,
          invoicePdf: invoiceData.invoice_pdf,
        },
      });

      // 4. Publish event for receipt sending
      await fastify.events.publish({
        eventType: 'SUBSCRIPTION_PAYMENT_SUCCEEDED',
        eventVersion: '1.0.0',
        actorId: subscription.organizationId,
        actorType: 'system',
        organizationId: subscription.organizationId,
        payload: {
          subscriptionId: subscription.id,
          invoiceId: invoiceData.id,
          amountPaid: invoiceData.amount_paid,
          currency: invoiceData.currency,
          hostedInvoiceUrl: invoiceData.hosted_invoice_url,
        },
        metadata: fastify.events.createMetadata('webhook', {
          eventId: event.eventId,
          eventType: 'invoice.payment_succeeded',
        }),
      });

      fastify.log.info(
        `Payment succeeded for subscription: ${subscription.id} - $${invoiceData.amount_paid / 100}`,
      );
    } catch (error) {
      fastify.log.error(
        { error, eventId: event.eventId },
        'Failed to process invoice.payment_succeeded webhook',
      );
      throw error;
    }
  };
