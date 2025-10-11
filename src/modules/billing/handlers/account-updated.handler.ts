import type Stripe from 'stripe';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '@/database';
import { stripeConnectedAccounts } from '@/modules/onboarding/schemas/onboarding.schema';

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
      company: account.company as any,
      individual: account.individual as any,
      requirements: account.requirements as any,
      capabilities: account.capabilities as any,
      externalAccounts: account.external_accounts as any,
      metadata: account.metadata as Record<string, string> | undefined,
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
