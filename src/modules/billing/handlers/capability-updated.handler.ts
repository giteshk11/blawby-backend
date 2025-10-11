import type Stripe from 'stripe';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '@/database';
import { stripeConnectedAccounts } from '@/modules/onboarding/schemas/onboarding.schema';

/**
 * Capability Updated Handler
 *
 * Handles Stripe capability.updated webhook events.
 * Updates the connected account capabilities in the database.
 */
export class CapabilityUpdatedHandler {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Handle capability.updated webhook event
   */
  async handle(event: Stripe.Event): Promise<void> {
    const capability = event.data.object as Stripe.Capability;

    this.fastify.log.info(
      {
        context: {
          component: 'CapabilityUpdatedHandler',
          operation: 'handle',
          accountId: capability.account,
          capabilityId: capability.id,
          eventId: event.id,
        },
      },
      'Processing capability.updated event',
    );

    try {
      // Update account capabilities
      await this.updateAccountCapabilities(capability);

      this.fastify.log.info(
        {
          context: {
            component: 'CapabilityUpdatedHandler',
            operation: 'handle',
            accountId: capability.account,
            capabilityId: capability.id,
            eventId: event.id,
          },
        },
        'Capability updated successfully',
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
            component: 'CapabilityUpdatedHandler',
            operation: 'handle',
            accountId: capability.account,
            capabilityId: capability.id,
            eventId: event.id,
          },
        },
        'Failed to update capability',
      );

      throw error;
    }
  }

  /**
   * Update account capabilities in database
   */
  private async updateAccountCapabilities(
    capability: Stripe.Capability,
  ): Promise<void> {
    // Get current account record
    const account = await db
      .select()
      .from(stripeConnectedAccounts)
      .where(
        eq(
          stripeConnectedAccounts.stripeAccountId,
          capability.account as string,
        ),
      )
      .limit(1);

    if (account.length === 0) {
      this.fastify.log.warn(
        {
          context: {
            component: 'CapabilityUpdatedHandler',
            operation: 'updateAccountCapabilities',
            accountId: capability.account,
            capabilityId: capability.id,
          },
        },
        'Account not found for capability update',
      );
      return;
    }

    // Update capabilities JSONB field
    const currentCapabilities = (account[0].capabilities as any) || {};
    const updatedCapabilities = {
      ...currentCapabilities,
      [capability.id]: {
        status: capability.status,
        requirements: capability.requirements,
        requested: capability.requested,
        requested_at: capability.requested_at,
      },
    };

    await db
      .update(stripeConnectedAccounts)
      .set({
        capabilities: updatedCapabilities,
        lastRefreshedAt: new Date(),
      })
      .where(
        eq(
          stripeConnectedAccounts.stripeAccountId,
          capability.account as string,
        ),
      );

    this.fastify.log.debug(
      {
        context: {
          component: 'CapabilityUpdatedHandler',
          operation: 'updateAccountCapabilities',
          accountId: capability.account,
          capabilityId: capability.id,
          status: capability.status,
          requirements: capability.requirements,
        },
      },
      'Account capabilities updated in database',
    );
  }
}
