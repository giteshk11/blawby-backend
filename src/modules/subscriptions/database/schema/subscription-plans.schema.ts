import {
  pgTable,
  uuid,
  text,
  decimal,
  jsonb,
  boolean,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Subscription Plans
export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Plan identification
  name: text('name').notNull().unique(), // 'starter', 'professional', 'enterprise'
  displayName: text('display_name').notNull(), // 'Starter Plan', 'Professional Plan'
  description: text('description'),

  // Pricing
  monthlyPrice: decimal('monthly_price', { precision: 10, scale: 2 }).notNull(),
  yearlyPrice: decimal('yearly_price', { precision: 10, scale: 2 }).notNull(),

  // Stripe integration
  stripeMonthlyPriceId: text('stripe_monthly_price_id').notNull(),
  stripeYearlyPriceId: text('stripe_yearly_price_id').notNull(),
  stripeProductId: text('stripe_product_id').notNull(),

  // Features and limits (denormalized for fast access)
  features: jsonb('features').notNull().$type<string[]>(), // ['invoicing', 'payments', 'advanced_reporting']
  limits: jsonb('limits').notNull().$type<Record<string, number>>(), // { users: 10, invoices_per_month: 100 }
  meteredItems: jsonb('metered_items').$type<
    Array<{
      priceId: string;
      meterName: string;
      type: 'user_count' | 'invoice_fee' | 'payout_fee' | 'custom_payment_fee';
    }>
  >(),

  // Plan status
  isActive: boolean('is_active').default(true).notNull(),
  isPublic: boolean('is_public').default(true).notNull(), // Show on pricing page
  sortOrder: integer('sort_order').default(0).notNull(),

  // Metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes will be added in a separate migration

// Zod schemas for validation
export const insertSubscriptionPlanSchema = createInsertSchema(
  subscriptionPlans,
  {
    name: z.string().min(1),
    displayName: z.string().min(1),
    monthlyPrice: z.string().regex(/^\d+\.\d{2}$/),
    yearlyPrice: z.string().regex(/^\d+\.\d{2}$/),
    features: z.array(z.string()),
    limits: z.record(z.string(), z.number()),
  },
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectSubscriptionPlanSchema =
  createSelectSchema(subscriptionPlans);

// Type exports
export type InsertSubscriptionPlan = z.infer<
  typeof insertSubscriptionPlanSchema
>;
export type SelectSubscriptionPlan = z.infer<
  typeof selectSubscriptionPlanSchema
>;
