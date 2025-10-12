/**
 * Invoice Paid Webhook Handler
 *
 * Handles invoice.paid webhook events from Stripe
 * Implements Laravel's invoice payment processing logic
 */

import type { FastifyInstance } from 'fastify';
import { invoicesRepository } from '@/modules/invoices/database/queries/invoices.repository';
// Transfers functionality removed - billing module deleted
import { connectedAccountsRepository } from '@/modules/onboarding/database/queries/connected-accounts.repository';
import {
  calculateInvoiceFees,
  getFeeConfig,
} from '@/shared/services/fees.service';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';

export const handleInvoicePaid = async function handleInvoicePaid(
  fastify: FastifyInstance,
  event: BaseEvent,
): Promise<void> {
  try {
    const invoiceData = event.payload as {
      id: string;
      customer: string;
      amount_paid: number;
      currency: string;
      payment_intent?: string;
      charge?: string;
      metadata?: Record<string, unknown>;
    };

    // 1. Find invoice in database
    const invoice = await invoicesRepository.findByStripeInvoiceId(
      invoiceData.id,
    );
    if (!invoice) {
      fastify.log.warn(`Invoice not found in database: ${invoiceData.id}`);
      return;
    }

    // 2. Get connected account
    const connectedAccount = await connectedAccountsRepository.findById(
      invoice.connectedAccountId,
    );
    if (!connectedAccount) {
      fastify.log.error(
        `Connected account not found for invoice: ${invoice.id}`,
      );
      return;
    }

    // 3. Calculate fees
    const feeConfig = getFeeConfig(connectedAccount.organizationId);
    const feeCalculation = calculateInvoiceFees(
      invoiceData.amount_paid,
      'card', // Default payment method type
      connectedAccount.country,
      feeConfig,
    );

    // 4. Update invoice with payment details
    await invoicesRepository.update(invoice.id, {
      amountPaid: invoiceData.amount_paid,
      amountRemaining: invoice.amountDue - invoiceData.amount_paid,
      status: 'paid',
      paidAt: new Date(),
      stripePaymentIntentId: invoiceData.payment_intent,
      stripeChargeId: invoiceData.charge,
      applicationFee: feeCalculation.applicationFee,
      stripeFee: feeCalculation.stripeFee,
      netAmount: feeCalculation.netAmount,
    });

    // 5. Publish events
    await fastify.events.publish({
      eventType: 'BILLING_INVOICE_PAID',
      eventVersion: '1.0.0',
      actorId: connectedAccount.organizationId,
      actorType: 'system',
      organizationId: connectedAccount.organizationId,
      payload: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amountPaid: invoiceData.amount_paid,
        netAmount: feeCalculation.netAmount,
        applicationFee: feeCalculation.applicationFee,
        stripeFee: feeCalculation.stripeFee,
      },
      metadata: fastify.events.createMetadata('webhook', {
        stripeEventId: event.eventId,
        eventType: 'invoice.paid',
      }),
    });

    fastify.log.info(
      `Invoice paid processed: ${invoice.invoiceNumber} - $${invoiceData.amount_paid / 100}`,
    );
  } catch (error) {
    fastify.log.error(
      { error, eventId: event.eventId },
      'Failed to process invoice.paid webhook',
    );
    throw error;
  }
};
