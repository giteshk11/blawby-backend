import type { FastifyInstance } from 'fastify';
import type Stripe from 'stripe';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';
import { paymentLinksRepository } from '../database/queries/payment-links.repository';
import { sendPaymentLinkReceipts } from '../services/payment-link-receipts.service';
import { getStripeClient } from '@/shared/services/stripe-client.service';

export const handleChargeSucceeded = async (
  fastify: FastifyInstance,
  event: BaseEvent,
): Promise<void> => {
  const charge = event.payload as unknown as Stripe.Charge;

  // Skip if this charge is not associated with a payment intent
  // (invoice payments don't use payment intents in the same way)
  if (!charge.payment_intent) {
    fastify.log.debug(
      {
        chargeId: charge.id,
      },
      'Skipping charge without payment intent',
    );
    return;
  }

  // Find payment link by payment_intent
  const paymentLink = await paymentLinksRepository.findByStripePaymentIntentId(
    charge.payment_intent as string,
  );

  if (!paymentLink) {
    fastify.log.warn(`Payment link not found for charge: ${charge.id}`);
    return;
  }

  // Calculate application fee from actual Stripe fees
  const stripe = getStripeClient();
  const balanceTransaction = await stripe.balanceTransactions.retrieve(
    charge.balance_transaction as string,
  );

  const totalStripeFee = balanceTransaction.fee;
  const applicationFee = Math.round(totalStripeFee * 1.3336); // 1.3336% markup

  // Update payment link
  await paymentLinksRepository.update(paymentLink.id, {
    status: charge.status,
    applicationFee,
    stripeChargeId: charge.id,
  });

  // Send receipts if payment succeeded
  if (charge.status === 'succeeded') {
    await sendPaymentLinkReceipts(fastify, paymentLink, charge);
  }

  fastify.log.info(
    {
      paymentLinkId: paymentLink.id,
      chargeId: charge.id,
      amount: charge.amount,
      applicationFee,
    },
    'Payment link updated from charge.succeeded',
  );
};
