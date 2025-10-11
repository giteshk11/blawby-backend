import type Stripe from 'stripe';
import type { FastifyInstance } from 'fastify';

/**
 * External Account Updated Handler
 *
 * Handles Stripe account.external_account.updated webhook events.
 * Updates external account information (bank accounts, cards) in the database.
 */
export class ExternalAccountUpdatedHandler {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Handle external_account.updated webhook event
   */
  async handle(event: Stripe.Event): Promise<void> {
    const externalAccount = event.data.object as Stripe.ExternalAccount;

    this.fastify.log.info(
      {
        context: {
          component: 'ExternalAccountUpdatedHandler',
          operation: 'handle',
          accountId: externalAccount.account,
          externalAccountId: externalAccount.id,
          type: (externalAccount as any).type || 'unknown',
          eventId: event.id,
        },
      },
      'Processing external_account.updated event',
    );

    try {
      // Update external account
      await this.updateExternalAccount(externalAccount);

      this.fastify.log.info(
        {
          context: {
            component: 'ExternalAccountUpdatedHandler',
            operation: 'handle',
            accountId: externalAccount.account,
            externalAccountId: externalAccount.id,
            type: (externalAccount as any).type || 'unknown',
            eventId: event.id,
          },
        },
        'External account updated successfully',
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
            component: 'ExternalAccountUpdatedHandler',
            operation: 'handle',
            accountId: externalAccount.account,
            externalAccountId: externalAccount.id,
            type: (externalAccount as any).type || 'unknown',
            eventId: event.id,
          },
        },
        'Failed to update external account',
      );

      throw error;
    }
  }

  /**
   * Update external account in database
   * TODO: Implement external account updates
   */
  private async updateExternalAccount(
    externalAccount: Stripe.ExternalAccount,
  ): Promise<void> {
    this.fastify.log.debug(
      {
        context: {
          component: 'ExternalAccountUpdatedHandler',
          operation: 'updateExternalAccount',
          accountId: externalAccount.account,
          externalAccountId: externalAccount.id,
          type: (externalAccount as any).type || 'unknown',
          metadata: externalAccount.metadata,
        },
      },
      'Updating external account (implementation pending)',
    );

    // TODO: Implement external account updates
    // 1. Find existing external account record
    // 2. Update verification status, requirements, etc.
    // 3. Handle status changes (verified, failed, etc.)
  }
}
