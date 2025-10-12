import {
  pgTable,
  uuid,
  text,
  decimal,
  jsonb,
  integer,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { subscriptions } from './subscriptions.schema';

// Enums
export const subscriptionItemTypeEnum = pgEnum('subscription_item_type', [
  'base_fee',
  'metered_users',
  'metered_invoice_fee',
  'metered_payout_fee',
  'metered_custom_payment_fee',
]);

// Subscription Line Items
export const subscriptionLineItems = pgTable('subscription_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  subscriptionId: uuid('subscription_id')
    .notNull()
    .references(() => subscriptions.id, { onDelete: 'cascade' }),

  // Stripe integration
  stripeSubscriptionItemId: text('stripe_subscription_item_id')
    .notNull()
    .unique(),
  stripePriceId: text('stripe_price_id').notNull(),

  // Item details
  itemType: subscriptionItemTypeEnum('item_type').notNull(),
  description: text('description'),
  quantity: integer('quantity').default(1).notNull(),
  unitAmount: decimal('unit_amount', { precision: 10, scale: 2 }), // null for metered items

  // Metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes will be added in a separate migration

// Zod schemas for validation
export const insertSubscriptionLineItemSchema = createInsertSchema(
  subscriptionLineItems,
  {
    unitAmount: z
      .string()
      .regex(/^\d+\.\d{2}$/)
      .nullable(),
  },
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectSubscriptionLineItemSchema = createSelectSchema(
  subscriptionLineItems,
);

// Type exports
export type InsertSubscriptionLineItem = z.infer<
  typeof insertSubscriptionLineItemSchema
>;
export type SelectSubscriptionLineItem = z.infer<
  typeof selectSubscriptionLineItemSchema
>;
