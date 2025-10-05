import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  json,
} from 'drizzle-orm/pg-core';

// Stripe Connected Accounts table
export const stripeConnectedAccounts = pgTable('stripe_connected_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  stripeAccountId: text('stripe_account_id').notNull().unique(),
  businessType: text('business_type'),
  type: text('type').notNull(),
  country: text('country').notNull(),
  email: text('email').notNull(),
  chargesEnabled: boolean('charges_enabled').default(false).notNull(),
  payoutsEnabled: boolean('payouts_enabled').default(false).notNull(),
  detailsSubmitted: boolean('details_submitted').default(false).notNull(),
  company: json('company'),
  individual: json('individual'),
  requirements: json('requirements'),
  capabilities: json('capabilities'),
  metadata: json('metadata'),
  externalAccounts: json('external_accounts'),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  customerId: text('customer_id'),
  setupIntentId: text('setup_intent_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Stripe Customers table
export const stripeCustomers = pgTable('stripe_customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  currency: text('currency').notNull().default('USD'),
  stripeCustomerId: text('stripe_customer_id').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Stripe Payouts table
export const stripePayouts = pgTable('stripe_payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  payoutAmount: integer('payout_amount').notNull(),
  paidAt: timestamp('paid_at').notNull(),
  stripeAccountId: text('stripe_account_id').notNull(),
  teamId: uuid('team_id').notNull(),
  stripePayoutId: text('stripe_payout_id').notNull().unique(),
  applicationFee: integer('application_fee').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Stripe Usage Events table
export const stripeUsageEvents = pgTable('stripe_usage_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventName: text('event_name').notNull(),
  object: text('object').notNull(),
  payload: text('payload').notNull(),
  stripeCustomerId: text('stripe_customer_id').notNull(),
  trackStripeSubscriptionId: uuid('track_stripe_subscription_id'),
  connectedAccountId: uuid('connected_account_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Stripe Custom Payments table
export const stripeCustomPayments = pgTable('stripe_custom_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  amount: integer('amount').notNull(),
  status: text('status').notNull().default('pending'),
  applicationFee: integer('application_fee'),
  stripePaymentIntentId: text('stripe_payment_intent_id').notNull().unique(),
  stripeChargeId: text('stripe_charge_id'),
  teamId: uuid('team_id').notNull(),
  connectedAccountId: uuid('connected_account_id').notNull(),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Stripe Subscriptions table
export const stripeSubscriptions = pgTable('stripe_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
  status: text('status').notNull(),
  startDate: timestamp('start_date').notNull(),
  connectedAccountId: uuid('connected_account_id').notNull(),
  stripeCustomerId: text('stripe_customer_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Export schema object for Drizzle
export const stripeSchema = {
  stripeConnectedAccounts,
  stripeCustomers,
  stripePayouts,
  stripeUsageEvents,
  stripeCustomPayments,
  stripeSubscriptions,
};
