/**
 * Payout Paid Webhook Handler
 *
 * Handles payout.paid webhook events from Stripe
 * Implements Laravel's payout processing logic
 */

import type { FastifyInstance } from 'fastify';
import { payoutsRepository } from '../database/queries/payouts.repository';
import { connectedAccountsRepository } from '@/modules/onboarding/database/queries/connected-accounts.repository';
import {
  calculatePayoutFees,
  getFeeConfig,
} from '@/shared/services/fees.service';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';

export const handlePayoutPaid = async function handlePayoutPaid(
  fastify: FastifyInstance,
  event: BaseEvent,
): Promise<void> {
  try {
    const payoutData = event.payload as {
      id: string;
      amount: number;
      currency: string;
      destination: string;
      arrival_date: number;
      metadata?: Record<string, unknown>;
    };

    // 1. Find connected account by Stripe account ID
    const connectedAccount =
      await connectedAccountsRepository.findByStripeAccountId(
        payoutData.destination,
      );
    if (!connectedAccount) {
      fastify.log.warn(
        `Connected account not found for payout: ${payoutData.destination}`,
      );
      return;
    }

    // 2. Check if payout already exists
    const existingPayout = await payoutsRepository.findByStripePayoutId(
      payoutData.id,
    );
    if (existingPayout) {
      fastify.log.info(`Payout already processed: ${payoutData.id}`);
      return;
    }

    // 3. Calculate application fee on payout
    const feeConfig = getFeeConfig(connectedAccount.organizationId);
    const feeCalculation = calculatePayoutFees(payoutData.amount, feeConfig);

    // 4. Store payout in database
    await payoutsRepository.create({
      connectedAccountId: connectedAccount.id,
      stripePayoutId: payoutData.id,
      amount: payoutData.amount,
      currency: payoutData.currency,
      applicationFee: feeCalculation.applicationFee,
      status: 'paid',
      destinationType: 'bank_account', // Default, could be determined from Stripe data
      destinationDetails: {
        destination: payoutData.destination,
      },
      arrivalDate: new Date(payoutData.arrival_date * 1000),
      paidAt: new Date(),
    });

    // 5. Publish events
    await fastify.events.publish({
      eventType: 'BILLING_PAYOUT_PAID',
      eventVersion: '1.0.0',
      actorId: connectedAccount.organizationId,
      actorType: 'system',
      organizationId: connectedAccount.organizationId,
      payload: {
        payoutId: payoutData.id,
        amount: payoutData.amount,
        applicationFee: feeCalculation.applicationFee,
        netAmount: feeCalculation.netAmount,
        connectedAccountId: connectedAccount.id,
      },
      metadata: fastify.events.createMetadata('webhook', {
        stripeEventId: event.eventId,
        eventType: 'payout.paid',
      }),
    });

    fastify.log.info(
      `Payout processed: ${payoutData.id} - $${payoutData.amount / 100}`,
    );
  } catch (error) {
    fastify.log.error(
      { error, eventId: event.eventId },
      'Failed to process payout.paid webhook',
    );
    throw error;
  }
};
