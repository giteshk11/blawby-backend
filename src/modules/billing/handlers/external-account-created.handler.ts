import type Stripe from 'stripe';
import type { FastifyInstance } from 'fastify';

/**
 * External Account Created Handler
 *
 * Handles Stripe account.external_account.created webhook events.
 * Stores external account information (bank accounts, cards) in the database.
 */
export class ExternalAccountCreatedHandler {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Handle external_account.created webhook event
   */
  async handle(event: Stripe.Event): Promise<void> {
    const externalAccount = event.data.object as Stripe.ExternalAccount;

    this.fastify.log.info(
      {
        context: {
          component: 'ExternalAccountCreatedHandler',
          operation: 'handle',
          accountId: externalAccount.account,
          externalAccountId: externalAccount.id,
          type: (externalAccount as any).type || 'unknown',
          eventId: event.id,
        },
      },
      'Processing external_account.created event',
    );

    try {
      // Store external account
      await this.storeExternalAccount(externalAccount);

      this.fastify.log.info(
        {
          context: {
            component: 'ExternalAccountCreatedHandler',
            operation: 'handle',
            accountId: externalAccount.account,
            externalAccountId: externalAccount.id,
            type: (externalAccount as any).type || 'unknown',
            eventId: event.id,
          },
        },
        'External account created successfully',
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
            component: 'ExternalAccountCreatedHandler',
            operation: 'handle',
            accountId: externalAccount.account,
            externalAccountId: externalAccount.id,
            type: (externalAccount as any).type || 'unknown',
            eventId: event.id,
          },
        },
        'Failed to store external account',
      );

      throw error;
    }
  }

  /**
   * Store external account in database
   * TODO: Create external_accounts table and implement storage
   */
  private async storeExternalAccount(
    externalAccount: Stripe.ExternalAccount,
  ): Promise<void> {
    this.fastify.log.debug(
      {
        context: {
          component: 'ExternalAccountCreatedHandler',
          operation: 'storeExternalAccount',
          accountId: externalAccount.account,
          externalAccountId: externalAccount.id,
          type: (externalAccount as any).type || 'unknown',
          metadata: externalAccount.metadata,
        },
      },
      'Storing external account (implementation pending)',
    );

    // TODO: Implement external account storage
    // 1. Create external_accounts table
    // 2. Store account details (bank account, card, etc.)
    // 3. Link to connected account
    // 4. Store verification status, requirements, etc.
  }
}
