import { db } from '@/database';
import {
  stripeOnboardingSessions,
  stripeWebhookEvents,
} from '../schemas/billing.schema';
import { stripeConnectedAccounts } from '@/modules/onboarding/schemas/onboarding.schema';
import { eq } from 'drizzle-orm';

class BillingRepository {
  // Connected Accounts
  async findConnectedAccountByOrganization(organizationId: string) {
    const results = await db
      .select()
      .from(stripeConnectedAccounts)
      .where(eq(stripeConnectedAccounts.organizationId, organizationId))
      .limit(1);

    return results[0] || null;
  }

  async findConnectedAccountByStripeId(accountId: string) {
    const results = await db
      .select()
      .from(stripeConnectedAccounts)
      .where(eq(stripeConnectedAccounts.stripeAccountId, accountId))
      .limit(1);

    return results[0] || null;
  }

  async createConnectedAccount(data: {
    organizationId: string;
    stripeAccountId: string;
    email: string;
    accountType?: string;
    country?: string;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
    detailsSubmitted?: boolean;
    businessType?: string;
    company?: any;
    individual?: any;
    requirements?: any;
    capabilities?: any;
    externalAccounts?: any;
    metadata?: any;
  }) {
    const results = await db
      .insert(stripeConnectedAccounts)
      .values(data)
      .returning();

    return results[0];
  }

  async updateConnectedAccount(
    organizationId: string,
    data: {
      status?: string;
      onboardingStatus?: string;
      requirements?: any;
      capabilities?: any;
      chargesEnabled?: boolean;
      payoutsEnabled?: boolean;
    },
  ) {
    const results = await db
      .update(stripeConnectedAccounts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(stripeConnectedAccounts.organizationId, organizationId))
      .returning();

    return results[0];
  }

  // Onboarding Sessions
  async findOnboardingSessionBySessionId(sessionId: string) {
    const results = await db
      .select()
      .from(stripeOnboardingSessions)
      .where(eq(stripeOnboardingSessions.sessionId, sessionId))
      .limit(1);

    return results[0] || null;
  }

  async createOnboardingSession(data: {
    connectedAccountId: string;
    sessionId: string;
    status?: string;
    expiresAt?: Date;
  }) {
    const results = await db
      .insert(stripeOnboardingSessions)
      .values(data)
      .returning();

    return results[0];
  }

  async updateOnboardingSession(
    sessionId: string,
    data: {
      status?: string;
      completedAt?: Date;
    },
  ) {
    const results = await db
      .update(stripeOnboardingSessions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(stripeOnboardingSessions.sessionId, sessionId))
      .returning();

    return results[0];
  }

  // Webhook Events
  async findWebhookEventByEventId(eventId: string) {
    const results = await db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.eventId, eventId))
      .limit(1);

    return results[0] || null;
  }

  async createWebhookEvent(data: {
    eventId: string;
    eventType: string;
    accountId?: string;
    processed?: boolean;
    data: any;
  }) {
    const results = await db
      .insert(stripeWebhookEvents)
      .values(data)
      .returning();
    return results[0];
  }

  async markWebhookEventProcessed(eventId: string) {
    const results = await db
      .update(stripeWebhookEvents)
      .set({ processed: true })
      .where(eq(stripeWebhookEvents.eventId, eventId))
      .returning();

    return results[0];
  }
}

export const billingRepository = new BillingRepository();
