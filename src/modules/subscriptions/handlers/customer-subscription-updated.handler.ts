/**
 * Customer Subscription Updated Webhook Handler
 *
 * Handles customer.subscription.updated webhook events from Stripe
 * Syncs subscription status and dates
 */

import type { FastifyInstance } from 'fastify';
import { subscriptions, subscriptionEvents } from '../database/schema';
import { eq } from 'drizzle-orm';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';

export const handleCustomerSubscriptionUpdated =
  async function handleCustomerSubscriptionUpdated(
    fastify: FastifyInstance,
    event: BaseEvent,
  ): Promise<void> {
    try {
      const subscriptionData = event.payload as {
        id: string;
        status: string;
        current_period_start: number;
        current_period_end: number;
        trial_end?: number;
        canceled_at?: number;
        cancel_at_period_end: boolean;
        ended_at?: number;
        previous_attributes?: {
          status?: string;
          current_period_start?: number;
          current_period_end?: number;
        };
      };

      // 1. Find subscription in database
      const subscription = await fastify.db.query.subscriptions.findFirst({
        where: eq(subscriptions.stripeSubscriptionId, subscriptionData.id),
      });

      if (!subscription) {
        fastify.log.warn(
          `Subscription not found in database: ${subscriptionData.id}`,
        );
        return;
      }

      // 2. Check if status changed
      const statusChanged =
        subscriptionData.previous_attributes?.status !==
        subscriptionData.status;
      const fromStatus =
        subscriptionData.previous_attributes?.status || subscription.status;

      // 3. Update subscription with latest data
      await fastify.db
        .update(subscriptions)
        .set({
          status: subscriptionData.status as string,
          currentPeriodStart: new Date(
            subscriptionData.current_period_start * 1000,
          ),
          currentPeriodEnd: new Date(
            subscriptionData.current_period_end * 1000,
          ),
          trialEndsAt: subscriptionData.trial_end
            ? new Date(subscriptionData.trial_end * 1000)
            : null,
          canceledAt: subscriptionData.canceled_at
            ? new Date(subscriptionData.canceled_at * 1000)
            : null,
          cancelAtPeriodEnd: subscriptionData.cancel_at_period_end,
          endsAt: subscriptionData.ended_at
            ? new Date(subscriptionData.ended_at * 1000)
            : null,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscription.id));

      // 4. Log status change event if status changed
      if (statusChanged) {
        await fastify.db.insert(subscriptionEvents).values({
          subscriptionId: subscription.id,
          eventType: 'status_changed',
          fromStatus,
          toStatus: subscriptionData.status,
          triggeredByType: 'webhook',
          metadata: {
            stripeSubscriptionId: subscriptionData.id,
            previousAttributes: subscriptionData.previous_attributes,
          },
        });

        // Handle specific status transitions
        if (
          subscriptionData.status === 'trialing' &&
          fromStatus !== 'trialing'
        ) {
          await fastify.db.insert(subscriptionEvents).values({
            subscriptionId: subscription.id,
            eventType: 'trial_ending',
            toStatus: subscriptionData.status,
            triggeredByType: 'webhook',
            metadata: {
              trialEndsAt: subscriptionData.trial_end
                ? new Date(subscriptionData.trial_end * 1000).toISOString()
                : null,
            },
          });
        }
      }

      fastify.log.info(
        `Updated subscription from webhook: ${subscription.id} - status: ${subscriptionData.status}`,
      );
    } catch (error) {
      fastify.log.error(
        { error, eventId: event.eventId },
        'Failed to process customer.subscription.updated webhook',
      );
      throw error;
    }
  };
