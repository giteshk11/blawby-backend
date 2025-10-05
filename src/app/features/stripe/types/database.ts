import * as tables from '../database/schema';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// TypeScript types for Stripe tables
export type StripeConnectedAccount =
  typeof tables.stripeConnectedAccounts.$inferSelect;
export type InsertStripeConnectedAccount =
  typeof tables.stripeConnectedAccounts.$inferInsert;

export type StripeCustomer = typeof tables.stripeCustomers.$inferSelect;
export type InsertStripeCustomer = typeof tables.stripeCustomers.$inferInsert;

export type StripePayout = typeof tables.stripePayouts.$inferSelect;
export type InsertStripePayout = typeof tables.stripePayouts.$inferInsert;

export type StripeUsageEvent = typeof tables.stripeUsageEvents.$inferSelect;
export type InsertStripeUsageEvent =
  typeof tables.stripeUsageEvents.$inferInsert;

export type StripeCustomPayment =
  typeof tables.stripeCustomPayments.$inferSelect;
export type InsertStripeCustomPayment =
  typeof tables.stripeCustomPayments.$inferInsert;

export type StripeSubscription = typeof tables.stripeSubscriptions.$inferSelect;
export type InsertStripeSubscription =
  typeof tables.stripeSubscriptions.$inferInsert;

// Zod schemas for Stripe tables
export const insertStripeConnectedAccountSchema = createInsertSchema(
  tables.stripeConnectedAccounts,
);
export const selectStripeConnectedAccountSchema = createSelectSchema(
  tables.stripeConnectedAccounts,
);

export const insertStripeCustomerSchema = createInsertSchema(
  tables.stripeCustomers,
);
export const selectStripeCustomerSchema = createSelectSchema(
  tables.stripeCustomers,
);

export const insertStripePayoutSchema = createInsertSchema(
  tables.stripePayouts,
);
export const selectStripePayoutSchema = createSelectSchema(
  tables.stripePayouts,
);

export const insertStripeUsageEventSchema = createInsertSchema(
  tables.stripeUsageEvents,
);
export const selectStripeUsageEventSchema = createSelectSchema(
  tables.stripeUsageEvents,
);

export const insertStripeCustomPaymentSchema = createInsertSchema(
  tables.stripeCustomPayments,
);
export const selectStripeCustomPaymentSchema = createSelectSchema(
  tables.stripeCustomPayments,
);

export const insertStripeSubscriptionSchema = createInsertSchema(
  tables.stripeSubscriptions,
);
export const selectStripeSubscriptionSchema = createSelectSchema(
  tables.stripeSubscriptions,
);
