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
export const payoutStatusEnum = pgEnum('payout_status', [
  'paid',
  'pending',
  'in_transit',
  'canceled',
  'failed',
]);

// Forward references (will be imported from other modules)
import { stripeConnectedAccounts } from '@/modules/onboarding/schemas/onboarding.schema';

// Payouts
export const payouts = pgTable('payouts', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  connectedAccountId: uuid('connected_account_id').notNull(),

  // Stripe
  stripePayoutId: text('stripe_payout_id').notNull().unique(),

  // Amounts (in cents)
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('usd'),
  applicationFee: integer('application_fee'),

  // Status
  status: payoutStatusEnum('status').notNull(),

  // Destination
  destinationType: text('destination_type'),
  destinationDetails: jsonb('destination_details').$type<
    Record<string, unknown>
  >(),

  // Dates
  arrivalDate: timestamp('arrival_date'),
  paidAt: timestamp('paid_at'),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Indexes - Temporarily commented out to debug
// export const payoutsConnectedAccountIdIdx = index(
//   'payouts_connected_account_id_idx',
// ).on(payouts.connectedAccountId);
// export const payoutsStatusIdx = index('payouts_status_idx').on(payouts.status);
// export const payoutsCreatedAtIdx = index('payouts_created_at_idx').on(
//   payouts.createdAt,
// );
// export const payoutsPaidAtIdx = index('payouts_paid_at_idx').on(payouts.paidAt);
// export const payoutsStripePayoutIdIdx = index(
//   'payouts_stripe_payout_id_idx',
// ).on(payouts.stripePayoutId);
// export const payoutsOrgStatusIdx = index('payouts_org_status_idx').on(
//   payouts.connectedAccountId,
//   payouts.status,
// );

// Zod schemas for validation
export const insertPayoutSchema = createInsertSchema(payouts, {
  currency: z.string().length(3),
}).omit({
  id: true,
  createdAt: true,
});

// Select schemas
export const selectPayoutSchema = createSelectSchema(payouts);

// Type exports
export type InsertPayout = z.infer<typeof insertPayoutSchema>;
export type SelectPayout = z.infer<typeof selectPayoutSchema>;
