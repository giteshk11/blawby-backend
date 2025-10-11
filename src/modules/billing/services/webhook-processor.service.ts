import type Stripe from 'stripe';
import type { FastifyInstance } from 'fastify';
import { EventType } from '@/shared/events/enums/event-types';

/**
 * Webhook Processor Service
 *
 * Main entry point for processing Stripe webhook events.
 * Routes events to appropriate handlers based on event type.
 *
 * Architecture:
 * - Receives webhook event from worker
 * - Routes to specific handler based on event.type
 * - Handlers update database and publish internal events
 * - All processing is idempotent (safe to run multiple times)
 */

export interface WebhookEvent {
  id: string;
  stripeEventId: string;
  eventType: string;
  payload: Stripe.Event;
  processed: boolean;
  retryCount: number;
  createdAt: Date;
}

export interface WebhookProcessorResult {
  success: boolean;
  eventId: string;
  eventType: string;
  handlerUsed?: string;
  error?: string;
}

/**
 * Main webhook processor class
 */
export class WebhookProcessor {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Process a webhook event
   *
   * @param webhook - Webhook event from database
   * @returns Processing result
   */
  async process(webhook: WebhookEvent): Promise<WebhookProcessorResult> {
    const event = webhook.payload as Stripe.Event;

    this.fastify.log.info(
      {
        context: {
          component: 'WebhookProcessor',
          operation: 'process',
          webhookId: webhook.id,
          eventId: webhook.stripeEventId,
          eventType: event.type,
        },
      },
      'Processing webhook event',
    );

    try {
      // Route to appropriate handler based on event type
      const result = await this.routeEvent(event, webhook);

      this.fastify.log.info(
        {
          context: {
            component: 'WebhookProcessor',
            operation: 'process',
            webhookId: webhook.id,
            eventId: webhook.stripeEventId,
            eventType: event.type,
            handlerUsed: result.handlerUsed,
          },
        },
        'Webhook event processed successfully',
      );

      return {
        success: true,
        eventId: webhook.stripeEventId,
        eventType: event.type,
        handlerUsed: result.handlerUsed,
      };
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
            component: 'WebhookProcessor',
            operation: 'process',
            webhookId: webhook.id,
            eventId: webhook.stripeEventId,
            eventType: event.type,
          },
        },
        'Failed to process webhook event',
      );

      return {
        success: false,
        eventId: webhook.stripeEventId,
        eventType: event.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Route event to appropriate handler
   */
  private async routeEvent(
    event: Stripe.Event,
    webhook: WebhookEvent,
  ): Promise<{ handlerUsed: string }> {
    switch (event.type) {
      case 'account.updated':
        return await this.handleAccountUpdated(event, webhook);

      case 'capability.updated':
        return await this.handleCapabilityUpdated(event, webhook);

      case 'account.external_account.created':
        return await this.handleExternalAccountCreated(event, webhook);

      case 'account.external_account.updated':
        return await this.handleExternalAccountUpdated(event, webhook);

      default:
        this.fastify.log.warn(
          {
            context: {
              component: 'WebhookProcessor',
              operation: 'routeEvent',
              eventType: event.type,
              eventId: event.id,
            },
          },
          'Unhandled webhook event type',
        );

        return { handlerUsed: 'unhandled' };
    }
  }

  /**
   * Handle account.updated events
   */
  private async handleAccountUpdated(
    event: Stripe.Event,
    webhook: WebhookEvent,
  ): Promise<{ handlerUsed: string }> {
    const account = event.data.object as Stripe.Account;

    this.fastify.log.info(
      {
        context: {
          component: 'WebhookProcessor',
          operation: 'handleAccountUpdated',
          accountId: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
        },
      },
      'Processing account.updated event',
    );

    // TODO: Update connected account in database
    // await this.updateConnectedAccount(account);

    // Publish internal event
    await this.fastify.events.publish({
      eventType: EventType.BILLING_ACCOUNT_UPDATED,
      eventVersion: '1.0.0',
      actorId: 'webhook-stripe',
      actorType: 'webhook',
      organizationId: await this.getOrganizationIdFromAccount(account.id),
      payload: {
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requirements: account.requirements,
        capabilities: account.capabilities,
      },
      metadata: this.fastify.events.createMetadata('webhook'),
    });

    return { handlerUsed: 'account-updated' };
  }

  /**
   * Handle capability.updated events
   */
  private async handleCapabilityUpdated(
    event: Stripe.Event,
    webhook: WebhookEvent,
  ): Promise<{ handlerUsed: string }> {
    const capability = event.data.object as Stripe.Capability;

    this.fastify.log.info(
      {
        context: {
          component: 'WebhookProcessor',
          operation: 'handleCapabilityUpdated',
          accountId: capability.account,
          capabilityId: capability.id,
          status: capability.status,
        },
      },
      'Processing capability.updated event',
    );

    // TODO: Update capability in database
    // await this.updateAccountCapability(capability);

    // Publish internal event
    await this.fastify.events.publish({
      eventType: EventType.BILLING_ACCOUNT_UPDATED, // Use existing event type
      eventVersion: '1.0.0',
      actorId: 'webhook-stripe',
      actorType: 'webhook',
      organizationId: await this.getOrganizationIdFromAccount(
        capability.account as string,
      ),
      payload: {
        accountId: capability.account,
        capabilityId: capability.id,
        status: capability.status,
        requirements: capability.requirements,
      },
      metadata: this.fastify.events.createMetadata('webhook'),
    });

    return { handlerUsed: 'capability-updated' };
  }

  /**
   * Handle account.external_account.created events
   */
  private async handleExternalAccountCreated(
    event: Stripe.Event,
    webhook: WebhookEvent,
  ): Promise<{ handlerUsed: string }> {
    const externalAccount = event.data.object as Stripe.ExternalAccount;

    this.fastify.log.info(
      {
        context: {
          component: 'WebhookProcessor',
          operation: 'handleExternalAccountCreated',
          accountId: externalAccount.account,
          externalAccountId: externalAccount.id,
          type: (externalAccount as any).type || 'unknown',
        },
      },
      'Processing external_account.created event',
    );

    // TODO: Store external account in database
    // await this.createExternalAccount(externalAccount);

    return { handlerUsed: 'external-account-created' };
  }

  /**
   * Handle account.external_account.updated events
   */
  private async handleExternalAccountUpdated(
    event: Stripe.Event,
    webhook: WebhookEvent,
  ): Promise<{ handlerUsed: string }> {
    const externalAccount = event.data.object as Stripe.ExternalAccount;

    this.fastify.log.info(
      {
        context: {
          component: 'WebhookProcessor',
          operation: 'handleExternalAccountUpdated',
          accountId: externalAccount.account,
          externalAccountId: externalAccount.id,
          type: (externalAccount as any).type || 'unknown',
        },
      },
      'Processing external_account.updated event',
    );

    // TODO: Update external account in database
    // await this.updateExternalAccount(externalAccount);

    return { handlerUsed: 'external-account-updated' };
  }

  /**
   * Get organization ID from Stripe account ID
   * TODO: Implement database lookup
   */
  private async getOrganizationIdFromAccount(
    accountId: string,
  ): Promise<string | undefined> {
    // TODO: Look up organization by Stripe account ID
    // const account = await this.findConnectedAccountByStripeId(accountId);
    // return account?.organizationId;

    this.fastify.log.warn(
      {
        context: {
          component: 'WebhookProcessor',
          operation: 'getOrganizationIdFromAccount',
          accountId,
        },
      },
      'Organization ID lookup not implemented',
    );

    return undefined;
  }
}

/**
 * Create webhook processor instance
 */
export const createWebhookProcessor = (
  fastify: FastifyInstance,
): WebhookProcessor => {
  return new WebhookProcessor(fastify);
};
