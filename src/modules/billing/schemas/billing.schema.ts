import {
  pgTable,
  uuid,
  text,
  json,
  timestamp,
  boolean,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Stripe onboarding sessions table
export const stripeOnboardingSessions = pgTable('stripe_onboarding_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  connectedAccountId: uuid('connected_account_id').notNull(),
  sessionId: text('session_id').notNull().unique(),
  status: text('status').default('pending'), // 'pending' | 'completed' | 'expired' | 'failed'
  expiresAt: timestamp('expires_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Stripe webhook events table
export const stripeWebhookEvents = pgTable('stripe_webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: text('event_id').notNull().unique(), // Stripe event ID
  eventType: text('event_type').notNull(),
  accountId: text('account_id'), // Stripe account ID (for connected accounts)
  processed: boolean('processed').default(false),
  data: json('data').notNull(), // Full event data
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Stripe Onboarding Session schemas
export const insertStripeOnboardingSessionSchema = createInsertSchema(
  stripeOnboardingSessions,
  {
    status: z.enum(['pending', 'completed', 'expired', 'failed']).optional(),
    sessionId: z.string().min(1, 'Session ID is required'),
  },
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectStripeOnboardingSessionSchema = createSelectSchema(
  stripeOnboardingSessions,
);

// Stripe Webhook Event schemas
export const insertStripeWebhookEventSchema = createInsertSchema(
  stripeWebhookEvents,
  {
    eventType: z.string().min(1, 'Event type is required'),
    eventId: z.string().min(1, 'Event ID is required'),
  },
).omit({
  id: true,
  createdAt: true,
});

export const selectStripeWebhookEventSchema =
  createSelectSchema(stripeWebhookEvents);

// Infer types from schemas
// Stripe Connected Account types - using onboarding schema instead

export type InsertStripeOnboardingSession = z.infer<
  typeof insertStripeOnboardingSessionSchema
>;
export type SelectStripeOnboardingSession = z.infer<
  typeof selectStripeOnboardingSessionSchema
>;

export type InsertStripeWebhookEvent = z.infer<
  typeof insertStripeWebhookEventSchema
>;
export type SelectStripeWebhookEvent = z.infer<
  typeof selectStripeWebhookEventSchema
>;
