import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Enums
export const paymentIntentStatusEnum = pgEnum('payment_intent_status', [
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
  'processing',
  'requires_capture',
  'canceled',
  'succeeded',
]);

// Forward references (will be imported from other modules)
// Temporarily commented out to debug circular dependency
// import { clients } from '@/modules/clients/database/schema/clients.schema';
// import { stripeConnectedAccounts } from '@/modules/onboarding/schemas/onboarding.schema';
// import { invoices } from '@/modules/invoices/database/schema/invoices.schema';

// Payment Intents
export const paymentIntents = pgTable('payment_intents', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  connectedAccountId: uuid('connected_account_id').notNull(),
  customerId: uuid('customer_id'),
  invoiceId: uuid('invoice_id'),

  // Stripe
  stripePaymentIntentId: text('stripe_payment_intent_id').notNull().unique(),
  stripeChargeId: text('stripe_charge_id'),

  // Amounts (in cents)
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('usd'),
  applicationFeeAmount: integer('application_fee_amount'),

  // Status
  status: paymentIntentStatusEnum('status').notNull(),

  // Payment Method
  paymentMethodId: text('payment_method_id'),
  paymentMethodType: text('payment_method_type'),

  // Customer Info (snapshot)
  customerEmail: text('customer_email'),
  customerName: text('customer_name'),

  // Metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  // Receipt
  receiptEmail: text('receipt_email'),
  receiptUrl: text('receipt_url'),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  succeededAt: timestamp('succeeded_at'),
});

// Indexes - Temporarily commented out to debug
// export const paymentIntentsConnectedAccountIdIdx = index(
//   'payment_intents_connected_account_id_idx',
// ).on(paymentIntents.connectedAccountId);
// Note: customerId and invoiceId indexes removed as they are optional fields
// export const paymentIntentsStatusIdx = index('payment_intents_status_idx').on(
//   paymentIntents.status,
// );
// export const paymentIntentsCreatedAtIdx = index(
//   'payment_intents_created_at_idx',
// ).on(paymentIntents.createdAt);
// export const paymentIntentsSucceededAtIdx = index(
//   'payment_intents_succeeded_at_idx',
// ).on(paymentIntents.succeededAt);
// export const paymentIntentsStripePaymentIntentIdIdx = index(
//   'payment_intents_stripe_payment_intent_id_idx',
// ).on(paymentIntents.stripePaymentIntentId);
// export const paymentIntentsOrgStatusIdx = index(
//   'payment_intents_org_status_idx',
// ).on(paymentIntents.connectedAccountId, paymentIntents.status);
// export const paymentIntentsOrgCreatedIdx = index(
//   'payment_intents_org_created_idx',
// ).on(paymentIntents.connectedAccountId, paymentIntents.createdAt);

// Zod schemas for validation
export const insertPaymentIntentSchema = createInsertSchema(paymentIntents, {
  currency: z.string().length(3),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Select schemas
export const selectPaymentIntentSchema = createSelectSchema(paymentIntents);

// Type exports
export type InsertPaymentIntent = z.infer<typeof insertPaymentIntentSchema>;
export type SelectPaymentIntent = z.infer<typeof selectPaymentIntentSchema>;
