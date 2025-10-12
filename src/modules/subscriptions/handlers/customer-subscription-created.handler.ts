/**
 * Customer Subscription Created Webhook Handler
 *
 * Handles customer.subscription.created webhook events from Stripe
 * Creates/updates local subscription record
 */

import type { FastifyInstance } from 'fastify';
import { subscriptions, subscriptionEvents } from '../database/schema';
import { eq } from 'drizzle-orm';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';

export const handleCustomerSubscriptionCreated =
  async function handleCustomerSubscriptionCreated(
    fastify: FastifyInstance,
    event: BaseEvent,
  ): Promise<void> {
    try {
      const subscriptionData = event.payload as {
        id: string;
        customer: string;
        status: string;
        current_period_start: number;
        current_period_end: number;
        trial_end?: number;
        items: {
          data: Array<{
            id: string;
            price: {
              id: string;
              nickname?: string;
            };
          }>;
        };
        metadata?: Record<string, unknown>;
      };

      // 1. Check if subscription already exists
      const existingSubscription =
        await fastify.db.query.subscriptions.findFirst({
          where: eq(subscriptions.stripeSubscriptionId, subscriptionData.id),
        });

      if (existingSubscription) {
        fastify.log.info(`Subscription already exists: ${subscriptionData.id}`);
        return;
      }

      // 2. Get organization from metadata
      const organizationId = subscriptionData.metadata
        ?.organizationId as string;
      if (!organizationId) {
        fastify.log.warn(
          `No organization ID in subscription metadata: ${subscriptionData.id}`,
        );
        return;
      }

      // 3. Create local subscription record
      const subscriptionRecord = {
        organizationId,
        stripeCustomerId: subscriptionData.customer,
        stripeSubscriptionId: subscriptionData.id,
        status: subscriptionData.status as string,
        currentPeriodStart: new Date(
          subscriptionData.current_period_start * 1000,
        ),
        currentPeriodEnd: new Date(subscriptionData.current_period_end * 1000),
        trialEndsAt: subscriptionData.trial_end
          ? new Date(subscriptionData.trial_end * 1000)
          : null,
        // These will be updated by other handlers
        planName: 'starter', // Default, will be updated
        billingCycle: 'monthly' as const,
        amount: '0.00',
        features: [],
        limits: {},
      };

      const [subscription] = await fastify.db
        .insert(subscriptions)
        .values(subscriptionRecord)
        .returning();

      // 4. Log creation event
      await fastify.db.insert(subscriptionEvents).values({
        subscriptionId: subscription.id,
        eventType: 'created',
        toStatus: subscription.status,
        triggeredByType: 'webhook',
        metadata: {
          stripeSubscriptionId: subscriptionData.id,
          stripeCustomerId: subscriptionData.customer,
        },
      });

      fastify.log.info(
        `Created subscription from webhook: ${subscription.id} for org ${organizationId}`,
      );
    } catch (error) {
      fastify.log.error(
        { error, eventId: event.eventId },
        'Failed to process customer.subscription.created webhook',
      );
      throw error;
    }
  };
