import {
  pgTable,
  uuid,
  text,
  decimal,
  jsonb,
  boolean,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { organizations } from '@/schema/better-auth-schema';
import { subscriptionPlans } from './subscription-plans.schema';

// Enums
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
]);

export const billingCycleEnum = pgEnum('billing_cycle', ['monthly', 'yearly']);

// Subscriptions
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').references(() => subscriptionPlans.id),

  // Stripe integration
  stripeCustomerId: text('stripe_customer_id').notNull(), // Platform customer
  stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
  stripePaymentMethodId: text('stripe_payment_method_id'),

  // Plan details (denormalized for quick access)
  planName: text('plan_name').notNull(),
  billingCycle: billingCycleEnum('billing_cycle').notNull(),

  // Status and dates
  status: subscriptionStatusEnum('status').notNull(),
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  trialEndsAt: timestamp('trial_ends_at'),
  canceledAt: timestamp('canceled_at'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  endsAt: timestamp('ends_at'),

  // Pricing
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('usd').notNull(),

  // Features and limits (denormalized from plan)
  features: jsonb('features').notNull().$type<string[]>(),
  limits: jsonb('limits').notNull().$type<Record<string, number>>(),

  // Metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes will be added in a separate migration

// Zod schemas for validation
export const insertSubscriptionSchema = createInsertSchema(subscriptions, {
  currency: z.string().length(3),
  features: z.array(z.string()),
  limits: z.record(z.string(), z.number()),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectSubscriptionSchema = createSelectSchema(subscriptions);

// Type exports
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type SelectSubscription = z.infer<typeof selectSubscriptionSchema>;
