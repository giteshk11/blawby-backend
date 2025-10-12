import type Stripe from 'stripe';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '@/database';
import {
  stripeConnectedAccounts,
  type Requirements,
  type Capabilities,
  type CompanyInfo,
  type IndividualInfo,
  ExternalAccounts,
} from '@/modules/onboarding/schemas/onboarding.schema';

/**
 * Account Updated Handler
 *
 * Handles Stripe account.updated webhook events.
 * Updates the connected account record in the database with latest status.
 */
export class AccountUpdatedHandler {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Handle account.updated webhook event
   */
  async handle(event: Stripe.Event): Promise<void> {
    const account = event.data.object as Stripe.Account;

    this.fastify.log.info(
      {
        context: {
          component: 'AccountUpdatedHandler',
          operation: 'handle',
          accountId: account.id,
          eventId: event.id,
        },
      },
      'Processing account.updated event',
    );

    try {
      // Update connected account record
      await this.updateConnectedAccount(account);

      this.fastify.log.info(
        {
          context: {
            component: 'AccountUpdatedHandler',
            operation: 'handle',
            accountId: account.id,
            eventId: event.id,
          },
        },
        'Account updated successfully',
      );
    } catch (error) {
      this.fastify.log.error(
        {
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                }
              : error,
          context: {
            component: 'AccountUpdatedHandler',
            operation: 'handle',
            accountId: account.id,
            eventId: event.id,
          },
        },
        'Failed to update account',
      );

      throw error;
    }
  }

  /**
   * Update connected account in database
   */
  private async updateConnectedAccount(account: Stripe.Account): Promise<void> {
    const updateData = {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      businessType: account.business_type,
      company: account.company as CompanyInfo,
      individual: account.individual as IndividualInfo,
      requirements: account.requirements as Requirements,
      capabilities: account.capabilities as Capabilities,
      externalAccounts: account.external_accounts as ExternalAccounts,
      metadata: account.metadata as Stripe.Metadata,
      lastRefreshedAt: new Date(),
    };

    await db
      .update(stripeConnectedAccounts)
      .set(updateData)
      .where(eq(stripeConnectedAccounts.stripeAccountId, account.id));

    this.fastify.log.debug(
      {
        context: {
          component: 'AccountUpdatedHandler',
          operation: 'updateConnectedAccount',
          accountId: account.id,
          updateData: {
            chargesEnabled: updateData.chargesEnabled,
            payoutsEnabled: updateData.payoutsEnabled,
            detailsSubmitted: updateData.detailsSubmitted,
            businessType: updateData.businessType,
          },
        },
      },
      'Connected account updated in database',
    );
  }
}

// Function wrapper for webhook processor
export const handleAccountUpdated = async function handleAccountUpdated(
  fastify: FastifyInstance,
  event: { eventId: string; eventType: string; payload: Stripe.Account },
): Promise<void> {
  const handler = new AccountUpdatedHandler(fastify);
  const stripeEvent = {
    id: event.eventId,
    type: event.eventType,
    data: { object: event.payload },
  } as Stripe.Event;
  await handler.handle(stripeEvent);
};
