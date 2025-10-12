/**
 * Subscription Service
 *
 * Handles subscription creation, management, and lifecycle
 * Manages subscriptions on platform account (not Connect)
 */

import type { FastifyInstance } from 'fastify';
import { organizations } from '@/schema/better-auth-schema';
import {
  subscriptions,
  subscriptionLineItems,
  subscriptionEvents,
  subscriptionPlans,
  type InsertSubscription,
  type InsertSubscriptionLineItem,
  type InsertSubscriptionEvent,
  type SelectSubscription,
} from '../database/schema';
import { eq, and } from 'drizzle-orm';
import { db } from '@/database';

export interface CreateSubscriptionRequest {
  organizationId: string;
  planName: string;
  billingCycle: 'monthly' | 'yearly';
}

export interface CreateSubscriptionResponse {
  success: boolean;
  subscription?: SelectSubscription;
  error?: string;
}

export interface ChangePlanRequest {
  subscriptionId: string;
  newPlanName: string;
  billingCycle: 'monthly' | 'yearly';
  prorate?: boolean;
}

export interface ChangePlanResponse {
  success: boolean;
  subscription?: SelectSubscription;
  error?: string;
}

export interface CancelSubscriptionRequest {
  subscriptionId: string;
  immediately?: boolean;
}

export interface CancelSubscriptionResponse {
  success: boolean;
  error?: string;
}

/**
 * Create subscription service
 */
export interface SubscriptionService {
  createSubscriptionForOrganization(
    request: CreateSubscriptionRequest,
  ): Promise<CreateSubscriptionResponse>;
  getActiveSubscription(
    organizationId: string,
  ): Promise<SelectSubscription | null>;
  checkAccess(organizationId: string, feature: string): Promise<boolean>;
  checkLimit(organizationId: string, limit: string): Promise<boolean>;
  syncFromStripe(stripeSubscriptionId: string): Promise<void>;
}

export const createSubscriptionService = function createSubscriptionService(
  fastify: FastifyInstance,
): SubscriptionService {
  return {
    /**
     * Create subscription for organization after payment setup
     */
    async createSubscriptionForOrganization(
      request: CreateSubscriptionRequest,
    ): Promise<CreateSubscriptionResponse> {
      try {
        // 1. Get organization and verify payment method
        const org = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, request.organizationId))
          .limit(1);

        if (!org[0]?.stripeCustomerId || !org[0].stripePaymentMethodId) {
          return {
            success: false,
            error: 'Organization does not have payment method setup',
          };
        }

        // 2. Get plan details
        const plan = await db
          .select()
          .from(subscriptionPlans)
          .where(eq(subscriptionPlans.name, request.planName))
          .limit(1);

        if (!plan[0]) {
          return {
            success: false,
            error: 'Plan not found',
          };
        }

        // 3. Create Stripe subscription
        const stripePriceId =
          request.billingCycle === 'monthly'
            ? plan[0].stripeMonthlyPriceId
            : plan[0].stripeYearlyPriceId;

        const stripeSubscription = await fastify.stripe.subscriptions.create({
          customer: org[0].stripeCustomerId,
          items: [
            {
              price: stripePriceId,
            },
          ],
          payment_behavior: 'default_incomplete',
          payment_settings: {
            save_default_payment_method: 'on_subscription',
          },
          expand: ['latest_invoice.payment_intent'],
          metadata: {
            organizationId: request.organizationId,
            planName: request.planName,
            billingCycle: request.billingCycle,
          },
        });

        // 4. Create local subscription record
        const subscriptionData: InsertSubscription = {
          organizationId: request.organizationId,
          planId: plan[0].id,
          stripeCustomerId: org[0].stripeCustomerId,
          stripeSubscriptionId: stripeSubscription.id,
          stripePaymentMethodId: org[0].stripePaymentMethodId,
          planName: request.planName,
          billingCycle: request.billingCycle as 'monthly' | 'yearly',
          status: stripeSubscription.status as
            | 'active'
            | 'trialing'
            | 'incomplete'
            | 'incomplete_expired'
            | 'past_due'
            | 'canceled'
            | 'unpaid',
          currentPeriodStart: new Date(
            stripeSubscription.current_period_start * 1000,
          ),
          currentPeriodEnd: new Date(
            stripeSubscription.current_period_end * 1000,
          ),
          trialEndsAt: stripeSubscription.trial_end
            ? new Date(stripeSubscription.trial_end * 1000)
            : null,
          amount:
            request.billingCycle === 'monthly'
              ? plan[0].monthlyPrice
              : plan[0].yearlyPrice,
          features: plan[0].features,
          limits: plan[0].limits,
        };

        const [subscription] = await db
          .insert(subscriptions)
          .values(subscriptionData)
          .returning();

        // 5. Create subscription line items
        const lineItemData: InsertSubscriptionLineItem = {
          subscriptionId: subscription.id,
          stripeSubscriptionItemId: stripeSubscription.items.data[0].id,
          stripePriceId,
          itemType: 'base_fee' as const,
          description: `${plan[0].displayName} - ${request.billingCycle}`,
          quantity: 1,
          unitAmount:
            request.billingCycle === 'monthly'
              ? plan[0].monthlyPrice
              : plan[0].yearlyPrice,
        };

        await db.insert(subscriptionLineItems).values(lineItemData);

        // 6. Update organization with active subscription
        await db
          .update(organizations)
          .set({
            activeSubscriptionId: subscription.id,
          })
          .where(eq(organizations.id, request.organizationId));

        // 7. Log creation event
        const eventData: InsertSubscriptionEvent = {
          subscriptionId: subscription.id,
          eventType: 'created' as const,
          toStatus: subscription.status,
          toPlanId: plan[0].id,
          triggeredByType: 'system',
          metadata: {
            planName: request.planName,
            billingCycle: request.billingCycle,
            stripeSubscriptionId: stripeSubscription.id,
          },
        };

        await db.insert(subscriptionEvents).values(eventData);

        // 8. Publish event
        await fastify.events.publish({
          eventType: 'SUBSCRIPTION_CREATED',
          eventVersion: '1.0.0',
          actorId: request.organizationId,
          actorType: 'organization',
          organizationId: request.organizationId,
          payload: {
            subscriptionId: subscription.id,
            planName: request.planName,
            billingCycle: request.billingCycle,
            amount: subscription.amount,
          },
          metadata: fastify.events.createMetadata('api'),
        });

        fastify.log.info(
          {
            organizationId: request.organizationId,
            subscriptionId: subscription.id,
            planName: request.planName,
          },
          'Created subscription for organization',
        );

        return {
          success: true,
          subscription,
        };
      } catch (error) {
        fastify.log.error(
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            organizationId: request.organizationId,
            planName: request.planName,
          },
          'Failed to create subscription',
        );

        return {
          success: false,
          error: 'Failed to create subscription',
        };
      }
    },

    /**
     * Get active subscription for organization
     */
    async getActiveSubscription(
      organizationId: string,
    ): Promise<SelectSubscription | null> {
      const results = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.organizationId, organizationId),
            eq(subscriptions.status, 'active'),
          ),
        )
        .limit(1);

      return results[0] || null;
    },

    /**
     * Check if organization has access to feature
     */
    async checkAccess(
      organizationId: string,
      feature: string,
    ): Promise<boolean> {
      const subscription = await this.getActiveSubscription(organizationId);
      if (!subscription?.features) return false;

      // Handle different feature types
      const features = subscription.features as Record<string, unknown>;
      return features[feature] === true;
    },

    /**
     * Check if organization is within limit
     */
    async checkLimit(organizationId: string, limit: string): Promise<boolean> {
      const subscription = await this.getActiveSubscription(organizationId);

      if (!subscription?.limits) return false;

      const limits = subscription.limits as Record<string, unknown>;
      const limitValue = limits[limit] as number;

      // If limit is -1, it means unlimited
      if (limitValue === -1) return true;

      // TODO: Implement usage tracking
      const used = 0;
      return typeof limitValue === 'number' && used < limitValue;
    },

    /**
     * Sync subscription from Stripe
     */
    async syncFromStripe(stripeSubscriptionId: string): Promise<void> {
      try {
        const stripeSubscription =
          await fastify.stripe.subscriptions.retrieve(stripeSubscriptionId);

        const subscriptionResults = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
          .limit(1);

        const subscription = subscriptionResults[0];

        if (!subscription) {
          fastify.log.warn(`Subscription not found: ${stripeSubscriptionId}`);
          return;
        }

        // Update subscription with latest data from Stripe
        await db
          .update(subscriptions)
          .set({
            status: stripeSubscription.status as
              | 'active'
              | 'trialing'
              | 'incomplete'
              | 'incomplete_expired'
              | 'past_due'
              | 'canceled'
              | 'unpaid',
            currentPeriodStart: new Date(
              stripeSubscription.current_period_start * 1000,
            ),
            currentPeriodEnd: new Date(
              stripeSubscription.current_period_end * 1000,
            ),
            trialEndsAt: stripeSubscription.trial_end
              ? new Date(stripeSubscription.trial_end * 1000)
              : null,
            canceledAt: stripeSubscription.canceled_at
              ? new Date(stripeSubscription.canceled_at * 1000)
              : null,
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            endsAt: stripeSubscription.ended_at
              ? new Date(stripeSubscription.ended_at * 1000)
              : null,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscription.id));

        fastify.log.info(
          `Synced subscription from Stripe: ${stripeSubscriptionId}`,
        );
      } catch (error) {
        fastify.log.error(
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            stripeSubscriptionId,
          },
          'Failed to sync subscription from Stripe',
        );
      }
    },
  };
};
