import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { subscriptions } from './subscriptions.schema';
import { subscriptionPlans } from './subscription-plans.schema';
import { users } from '@/schema/better-auth-schema';

// Enums
export const subscriptionEventTypeEnum = pgEnum('subscription_event_type', [
  'created',
  'plan_changed',
  'status_changed',
  'canceled',
  'resumed',
  'payment_succeeded',
  'payment_failed',
  'trial_ending',
]);

export const triggeredByTypeEnum = pgEnum('triggered_by_type', [
  'user',
  'system',
  'webhook',
]);

// Subscription Events
export const subscriptionEvents = pgTable('subscription_events', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  subscriptionId: uuid('subscription_id')
    .notNull()
    .references(() => subscriptions.id, { onDelete: 'cascade' }),

  // Event details
  eventType: subscriptionEventTypeEnum('event_type').notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status'),
  fromPlanId: uuid('from_plan_id').references(() => subscriptionPlans.id),
  toPlanId: uuid('to_plan_id').references(() => subscriptionPlans.id),

  // Who triggered the event
  triggeredBy: text('triggered_by').references(() => users.id),
  triggeredByType: triggeredByTypeEnum('triggered_by_type'),

  // Additional context
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  errorMessage: text('error_message'),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Indexes will be added in a separate migration

// Zod schemas for validation
export const insertSubscriptionEventSchema = createInsertSchema(
  subscriptionEvents,
  {
    metadata: z.record(z.string(), z.unknown()).optional(),
  },
).omit({
  id: true,
  createdAt: true,
});

export const selectSubscriptionEventSchema =
  createSelectSchema(subscriptionEvents);

// Type exports
export type InsertSubscriptionEvent = z.infer<
  typeof insertSubscriptionEventSchema
>;
export type SelectSubscriptionEvent = z.infer<
  typeof selectSubscriptionEventSchema
>;
