import { eq, and, lte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  stripeConnectedAccounts,
  webhookEvents,
  type StripeConnectedAccount,
  type NewStripeConnectedAccount,
  type WebhookEvent,
  type NewWebhookEvent,
} from '@/modules/onboarding/schemas/onboarding.schema';

export const findByOrganization = async (
  db: NodePgDatabase,
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
  db: NodePgDatabase,
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
  db: NodePgDatabase,
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
  db: NodePgDatabase,
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
  db: NodePgDatabase,
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
  db: NodePgDatabase,
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
  db: NodePgDatabase,
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

export const findByStripeEventId = async (
  db: NodePgDatabase,
  eventId: string,
): Promise<WebhookEvent | null> => {
  const events = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.stripeEventId, eventId))
    .limit(1);

  return events[0] || null;
};

export const createWebhookEvent = async (
  db: NodePgDatabase,
  data: NewWebhookEvent,
): Promise<WebhookEvent> => {
  const [event] = await db.insert(webhookEvents).values(data).returning();

  return event;
};

export const markWebhookProcessed = async (
  db: NodePgDatabase,
  id: string,
): Promise<void> => {
  await db
    .update(webhookEvents)
    .set({
      processed: true,
      processedAt: new Date(),
    })
    .where(eq(webhookEvents.id, id));
};

export const markWebhookFailed = async (
  db: NodePgDatabase,
  id: string,
  error: string,
  errorStack?: string,
): Promise<void> => {
  const event = await findWebhookById(db, id);
  if (!event) return;

  const retryCount = event.retryCount + 1;
  const maxRetries = event.maxRetries;

  // Calculate next retry time with exponential backoff
  let nextRetryAt: Date | null = null;
  if (retryCount <= maxRetries) {
    const backoffMinutes = Math.pow(5, retryCount); // 1min, 5min, 15min
    nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
  }

  await db
    .update(webhookEvents)
    .set({
      retryCount,
      error,
      errorStack,
      nextRetryAt,
    })
    .where(eq(webhookEvents.id, id));
};

export const getEventsToRetry = async (
  db: NodePgDatabase,
): Promise<WebhookEvent[]> => {
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

const findWebhookById = async (
  db: NodePgDatabase,
  id: string,
): Promise<WebhookEvent | null> => {
  const events = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.id, id))
    .limit(1);

  return events[0] || null;
};
