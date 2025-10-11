import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type Stripe from 'stripe';
import {
  webhookEvents,
  type WebhookEvent,
  type NewWebhookEvent,
} from '@/modules/stripe/schemas/webhook-events.schema';

export const existsByStripeEventId = async (
  db: NodePgDatabase,
  stripeEventId: string,
): Promise<boolean> => {
  const events = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.stripeEventId, stripeEventId))
    .limit(1);

  return events.length > 0;
};

export const createStripeWebhookEvent = async (
  db: NodePgDatabase,
  event: Stripe.Event,
  headers: Record<string, string>,
  url: string,
): Promise<WebhookEvent> => {
  const newEvent: NewWebhookEvent = {
    stripeEventId: event.id,
    eventType: event.type,
    payload: event,
    headers,
    url,
  };

  const [webhookEvent] = await db
    .insert(webhookEvents)
    .values(newEvent)
    .returning();

  return webhookEvent;
};

export const findStripeWebhookById = async (
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

export const markStripeWebhookProcessed = async (
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

export const markStripeWebhookFailed = async (
  db: NodePgDatabase,
  id: string,
  error: string,
  _errorStack?: string,
): Promise<void> => {
  const event = await findStripeWebhookById(db, id);
  if (!event) return;

  const retryCount = event.retryCount + 1;

  await db
    .update(webhookEvents)
    .set({
      retryCount,
      error,
    })
    .where(eq(webhookEvents.id, id));
};
