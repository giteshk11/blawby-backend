import type { FastifyInstance } from 'fastify';
import type Stripe from 'stripe';
import type { SelectPaymentLink } from '../database/schema/payment-links.schema';
import { db } from '@/shared/database';
import { organizations } from '@/schema';
import { eq } from 'drizzle-orm';

export const sendPaymentLinkReceipts = async function sendPaymentLinkReceipts(
  fastify: FastifyInstance,
  paymentLink: SelectPaymentLink,
  charge: Stripe.Charge,
): Promise<void> {
  try {
    // Get organization details
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, paymentLink.organizationId),
    });

    if (!organization) {
      fastify.log.error('Organization not found for payment link', {
        paymentLinkId: paymentLink.id,
      });
      return;
    }

    const customerEmail = paymentLink.metadata?.email;
    const customerName = paymentLink.metadata?.name;

    if (!customerEmail) {
      fastify.log.warn('No customer email for payment link', {
        paymentLinkId: paymentLink.id,
      });
      return;
    }

    // Format amounts
    const amountDollars = (paymentLink.amount / 100).toFixed(2);
    const applicationFeeDollars = paymentLink.applicationFee
      ? (paymentLink.applicationFee / 100).toFixed(2)
      : '0.00';

    // Customer receipt
    const _customerReceiptData = {
      to: customerEmail,
      subject: `Payment Receipt - ${organization.name}`,
      template: 'payment-link-customer-receipt',
      data: {
        organizationName: organization.name,
        organizationLogo: organization.logo,
        customerName: customerName || 'Customer',
        amount: amountDollars,
        currency: paymentLink.currency.toUpperCase(),
        receiptId: paymentLink.ulid,
        paymentDate: new Date().toLocaleDateString(),
        onBehalfOf: paymentLink.metadata?.on_behalf_of,
      },
    };

    // Organization receipt
    const _organizationReceiptData = {
      to: organization.billingEmail || organization.stripeCustomerId, // Fallback to Stripe customer
      subject: `Payment Received - ${customerName || 'Customer'}`,
      template: 'payment-link-organization-receipt',
      data: {
        organizationName: organization.name,
        customerName: customerName || 'Customer',
        customerEmail,
        amount: amountDollars,
        applicationFee: applicationFeeDollars,
        netAmount: (
          (paymentLink.amount - (paymentLink.applicationFee || 0)) /
          100
        ).toFixed(2),
        currency: paymentLink.currency.toUpperCase(),
        receiptId: paymentLink.ulid,
        paymentDate: new Date().toLocaleDateString(),
        onBehalfOf: paymentLink.metadata?.on_behalf_of,
        stripeChargeId: charge.id,
      },
    };

    // Send emails (implement your email service here)
    // await fastify.emailService.send(_customerReceiptData);
    // await fastify.emailService.send(_organizationReceiptData);

    fastify.log.info(
      {
        paymentLinkId: paymentLink.id,
        customerEmail,
        organizationId: organization.id,
      },
      'Payment link receipts sent',
    );
  } catch (error) {
    fastify.log.error(
      {
        error,
        paymentLinkId: paymentLink.id,
      },
      'Failed to send payment link receipts',
    );
  }
};
