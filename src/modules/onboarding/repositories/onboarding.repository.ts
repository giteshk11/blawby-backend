import { eq, and, lte, gt } from 'drizzle-orm';
import {
  stripeConnectedAccounts,
  stripeAccountSessions,
  type StripeConnectedAccount,
  type NewStripeConnectedAccount,
  type StripeAccountSession,
} from '@/modules/onboarding/schemas/onboarding.schema';
import {
  webhookEvents,
  type WebhookEvent,
} from '@/shared/schemas/stripe.webhook-events.schema';
import { db } from '@/shared/database';

export const findByOrganization = async (
  organizationId: string,
): Promise<StripeConnectedAccount | null> => {
  const accounts = await db
    .select()
    .from(stripeConnectedAccounts)
    .where(eq(stripeConnectedAccounts.organizationId, organizationId))
    .limit(1);

  return accounts[0] || null;
};

export const findByStripeId = async (
  stripeAccountId: string,
): Promise<StripeConnectedAccount | null> => {
  const accounts = await db
    .select()
    .from(stripeConnectedAccounts)
    .where(eq(stripeConnectedAccounts.stripeAccountId, stripeAccountId))
    .limit(1);

  return accounts[0] || null;
};

export const findById = async (
  id: string,
): Promise<StripeConnectedAccount | null> => {
  const accounts = await db
    .select()
    .from(stripeConnectedAccounts)
    .where(eq(stripeConnectedAccounts.id, id))
    .limit(1);

  return accounts[0] || null;
};

export const createStripeConnectedAccount = async (
  data: NewStripeConnectedAccount,
): Promise<StripeConnectedAccount> => {
  const [account] = await db
    .insert(stripeConnectedAccounts)
    .values({
      ...data,
      updatedAt: new Date(),
    })
    .returning();

  return account;
};

export const updateStripeConnectedAccount = async (
  id: string,
  data: Partial<NewStripeConnectedAccount>,
): Promise<StripeConnectedAccount> => {
  const [account] = await db
    .update(stripeConnectedAccounts)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(stripeConnectedAccounts.id, id))
    .returning();

  return account;
};

export const updateStripeConnectedAccountByStripeId = async (
  stripeAccountId: string,
  data: Partial<NewStripeConnectedAccount>,
): Promise<StripeConnectedAccount> => {
  const [account] = await db
    .update(stripeConnectedAccounts)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(stripeConnectedAccounts.stripeAccountId, stripeAccountId))
    .returning();

  return account;
};

export const updateLastRefreshed = async (
  stripeAccountId: string,
): Promise<void> => {
  await db
    .update(stripeConnectedAccounts)
    .set({
      lastRefreshedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(stripeConnectedAccounts.stripeAccountId, stripeAccountId));
};

export const getEventsToRetry = async (): Promise<WebhookEvent[]> => {
  const now = new Date();
  return await db
    .select()
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.processed, false),
        lte(webhookEvents.nextRetryAt, now),
      ),
    );
};

export const findWebhookById = async (
  id: string,
): Promise<WebhookEvent | null> => {
  const events = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.id, id))
    .limit(1);

  return events[0] || null;
};

// ============ Session Repository Methods ============

/**
 * Get active session for an account
 * Returns only sessions that are active and not expired
 */
export const getActiveSession = async (
  stripeAccountId: string,
  sessionType: 'onboarding' | 'payments' | 'payouts' = 'onboarding',
): Promise<StripeAccountSession | null> => {
  const now = new Date();

  const sessions = await db
    .select()
    .from(stripeAccountSessions)
    .where(
      and(
        eq(stripeAccountSessions.stripeAccountId, stripeAccountId),
        eq(stripeAccountSessions.sessionType, sessionType),
        eq(stripeAccountSessions.isActive, true),
        gt(stripeAccountSessions.expiresAt, now),
      ),
    )
    .limit(1);

  const session = sessions[0] || null;

  // Debug logging
  if (session) {
    console.log('Found active session:', {
      sessionId: session.id,
      expiresAt: session.expiresAt,
      now: now,
      timeUntilExpiry: session.expiresAt.getTime() - now.getTime(),
      timeUntilExpiryMinutes: Math.round(
        (session.expiresAt.getTime() - now.getTime()) / (1000 * 60),
      ),
    });
  } else {
    console.log('No active session found for:', {
      stripeAccountId,
      sessionType,
      now: now,
    });
  }

  return session;
};

/**
 * Create new session in database
 */
export const createSession = async (data: {
  stripeAccountId: string;
  sessionType: string;
  clientSecret: string;
  expiresAt: Date;
}): Promise<StripeAccountSession> => {
  const sessions = await db
    .insert(stripeAccountSessions)
    .values({
      ...data,
      isActive: true,
    })
    .returning();

  return sessions[0];
};

/**
 * Revoke old sessions when creating a new one
 * Marks all active sessions of the same type as inactive
 */
export const revokeOldSessions = async (
  stripeAccountId: string,
  sessionType: string,
): Promise<void> => {
  await db
    .update(stripeAccountSessions)
    .set({
      isActive: false,
      revokedAt: new Date(),
    })
    .where(
      and(
        eq(stripeAccountSessions.stripeAccountId, stripeAccountId),
        eq(stripeAccountSessions.sessionType, sessionType),
        eq(stripeAccountSessions.isActive, true),
      ),
    );
};
