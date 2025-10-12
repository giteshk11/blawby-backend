/**
 * Onboarding Completed Handler
 *
 * Handles onboarding completion events and triggers automatic subscription creation
 */

import { subscribeToEvent } from '@/shared/events/event-consumer';
import { EventType } from '@/shared/events/enums/event-types';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';
import { createPaymentSetupService } from '@/modules/subscriptions/services/payment-setup.service';
import { createSubscriptionService } from '@/modules/subscriptions/services/subscription.service';
import { db } from '@/database';
import { organizations } from '@/schema/better-auth-schema';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

// Initialize Stripe with platform secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

/**
 * Handle onboarding completion and automatically create subscription
 */
const handleOnboardingCompleted = async (event: BaseEvent): Promise<void> => {
  const { organizationId } = event;

  if (!organizationId) {
    console.error('No organization ID in onboarding completed event');
    return;
  }

  try {
    console.log(
      `Starting automatic subscription setup for organization: ${organizationId}`,
    );

    // Create Fastify instance for services
    const fastifyInstance = {
      log: {
        info: (data: unknown, message: string): void =>
          console.log(`[ONBOARDING] ${message}:`, data),
        error: (data: unknown, message: string): void =>
          console.error(`[ONBOARDING] ${message}:`, data),
        warn: (data: unknown, message: string): void =>
          console.warn(`[ONBOARDING] ${message}:`, data),
      },
      events: {
        publish: async (event: {
          eventType: string;
          eventVersion: string;
          actorId: string;
          actorType: string;
          organizationId: string;
          payload: unknown;
          metadata: unknown;
        }): Promise<void> => {
          console.log(`[ONBOARDING] Publishing: ${event.eventType}`);
        },
        createMetadata: (
          source: string,
        ): { source: string; timestamp: string } => ({
          source,
          timestamp: new Date().toISOString(),
        }),
      },
      stripe,
    };

    // Get organization details
    const orgResults = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    const org = orgResults[0];
    if (!org) {
      console.error(`Organization not found: ${organizationId}`);
      return;
    }

    // Check if organization already has a subscription
    if (org.activeSubscriptionId) {
      console.log(
        `Organization ${organizationId} already has an active subscription`,
      );
      return;
    }

    // Step 1: Create platform customer if not exists
    const paymentSetupService = createPaymentSetupService(
      fastifyInstance as unknown as Parameters<
        typeof createPaymentSetupService
      >[0],
    );

    if (!org.stripeCustomerId) {
      console.log(
        `Creating platform customer for organization: ${organizationId}`,
      );

      const customerResult = await paymentSetupService.createPlatformCustomer({
        organizationId,
        email: org.billingEmail || 'admin@example.com',
        name: org.name || 'Organization Admin',
      });

      if (!customerResult.success) {
        console.error(
          `Failed to create platform customer: ${customerResult.error}`,
        );
        return;
      }

      console.log(`Platform customer created: ${customerResult.customerId}`);
    }

    // Step 2: Create setup intent for payment method collection
    console.log(`Creating setup intent for organization: ${organizationId}`);

    const setupIntentResult = await paymentSetupService.createSetupIntent({
      organizationId,
      customerId: org.stripeCustomerId!,
    });

    if (!setupIntentResult.success) {
      console.error(
        `Failed to create setup intent: ${setupIntentResult.error}`,
      );
      return;
    }

    console.log(`Setup intent created: ${setupIntentResult.clientSecret}`);

    // Step 3: For now, we'll skip automatic payment method collection
    // In a real implementation, you would:
    // 1. Redirect user to payment method collection page
    // 2. Wait for payment method to be attached
    // 3. Then create subscription

    // For testing purposes, we'll create a test payment method
    // In production, this would be handled by the frontend
    console.log(
      'Note: Payment method collection should be handled by frontend',
    );
    console.log('Setup intent client secret:', setupIntentResult.clientSecret);

    // Step 4: Create subscription with default plan
    const subscriptionService = createSubscriptionService(
      fastifyInstance as unknown as Parameters<
        typeof createSubscriptionService
      >[0],
    );

    console.log(`Creating subscription for organization: ${organizationId}`);

    const subscriptionResult =
      await subscriptionService.createSubscriptionForOrganization({
        organizationId,
        planName: 'starter', // Default plan
        billingCycle: 'monthly', // Default billing cycle
      });

    if (!subscriptionResult.success) {
      console.error(
        `Failed to create subscription: ${subscriptionResult.error}`,
      );
      return;
    }

    console.log(
      `✅ Subscription created successfully for organization: ${organizationId}`,
    );
    console.log(`Subscription ID: ${subscriptionResult.subscription?.id}`);

    // Publish subscription created event
    await fastifyInstance.events.publish({
      eventType: 'SUBSCRIPTION_CREATED',
      eventVersion: '1.0.0',
      actorId: organizationId,
      actorType: 'organization',
      organizationId,
      payload: {
        subscriptionId: subscriptionResult.subscription?.id,
        planName: 'starter',
        billingCycle: 'monthly',
      },
      metadata: fastifyInstance.events.createMetadata('onboarding-handler'),
    });
  } catch (error) {
    console.error(
      `Failed to handle onboarding completion for organization ${organizationId}:`,
      error,
    );
  }
};

/**
 * Register onboarding event handlers
 */
export const registerOnboardingHandlers = (): void => {
  // Handle onboarding completion - automatically create subscription
  subscribeToEvent(EventType.ONBOARDING_COMPLETED, handleOnboardingCompleted);

  console.log('✅ Onboarding event handlers registered');
};
