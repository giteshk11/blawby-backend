import {
  pgTable,
  uuid,
  text,
  json,
  timestamp,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { organizations } from '@/schema';

// TypeScript types for JSON fields
export type CompanyInfo = {
  name?: string;
  tax_id?: string;
  address?: Address;
};

export type IndividualInfo = {
  first_name?: string;
  last_name?: string;
  email?: string;
  dob?: { day?: number; month?: number; year?: number };
  ssn_last_4?: string;
  address?: Address;
};

export type Address = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

export type Requirements = {
  currently_due: string[];
  eventually_due: string[];
  past_due: string[];
  pending_verification: string[];
  current_deadline?: number | null;
  disabled_reason?: string | null;
};

export type Capabilities = {
  card_payments?: string;
  transfers?: string;
  us_bank_account_ach_payments?: string;
};

export type ExternalAccount = {
  id: string;
  object: string;
  account?: string;
  account_holder_name?: string;
  account_holder_type?: string;
  bank_name?: string;
  country?: string;
  currency?: string;
  default_for_currency?: boolean;
  fingerprint?: string;
  last4?: string;
  metadata?: Record<string, string>;
  routing_number?: string;
  status?: string;
};

export type ExternalAccounts = {
  object: 'list';
  data: ExternalAccount[];
};

// Stripe connected accounts table
export const stripeConnectedAccounts = pgTable('stripe_connected_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  stripeAccountId: text('account_id').notNull().unique(),
  accountType: text('account_type').default('custom').notNull(),
  country: text('country').default('US').notNull(),
  email: text('email').notNull(),
  chargesEnabled: boolean('charges_enabled').default(false).notNull(),
  payoutsEnabled: boolean('payouts_enabled').default(false).notNull(),
  detailsSubmitted: boolean('details_submitted').default(false).notNull(),
  businessType: text('business_type'), // Stripe.Account.BusinessType
  company: json('company').$type<CompanyInfo>(),
  individual: json('individual').$type<IndividualInfo>(),
  requirements: json('requirements').$type<Requirements>(),
  capabilities: json('capabilities').$type<Capabilities>(),
  externalAccounts: json('external_accounts').$type<ExternalAccounts>(),
  metadata: json('metadata').$type<Record<string, string>>(),
  onboardingCompletedAt: timestamp('onboarding_completed_at'),
  lastRefreshedAt: timestamp('last_refreshed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Stripe account sessions table (normalized)
export const stripeAccountSessions = pgTable('stripe_account_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  stripeAccountId: text('stripe_account_id')
    .notNull()
    .references(() => stripeConnectedAccounts.stripeAccountId, {
      onDelete: 'cascade',
    }),
  sessionType: text('session_type').notNull(), // 'onboarding', 'payments', 'payouts'
  clientSecret: text('client_secret').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
});

// Webhook events table
export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  stripeEventId: text('stripe_event_id').notNull().unique(),
  eventType: text('event_type').notNull(),
  processed: boolean('processed').default(false).notNull(),
  processedAt: timestamp('processed_at'),
  error: text('error'),
  errorStack: text('error_stack'),
  retryCount: integer('retry_count').default(0).notNull(),
  maxRetries: integer('max_retries').default(3).notNull(),
  nextRetryAt: timestamp('next_retry_at'),
  payload: json('payload').notNull(),
  headers: json('headers').$type<Record<string, string>>(),
  url: text('url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Zod schemas for validation
export const createStripeConnectedAccountSchema = createInsertSchema(
  stripeConnectedAccounts,
  {
    email: z.email('Invalid email format'),
    country: z.string().length(2),
    businessType: z
      .enum(['individual', 'company', 'non_profit', 'government_entity'])
      .optional(),
  },
);

export const updateStripeConnectedAccountSchema = createInsertSchema(
  stripeConnectedAccounts,
  {
    email: z.string().email().optional(),
    country: z.string().length(2).optional(),
    businessType: z
      .enum(['individual', 'company', 'non_profit', 'government_entity'])
      .optional(),
  },
).partial();

export const createWebhookEventSchema = createInsertSchema(webhookEvents);

export const selectStripeConnectedAccountSchema = createSelectSchema(
  stripeConnectedAccounts,
);
export const selectWebhookEventSchema = createSelectSchema(webhookEvents);

// Request/Response schemas
export const createAccountRequestSchema = z.object({
  email: z.string().email(),
  country: z.string().length(2).default('US'),
});

export const createAccountResponseSchema = z.object({
  accountId: z.string(),
  clientSecret: z.string().optional(), // Only when sessionStatus = 'valid' or 'created'
  expiresAt: z.union([z.number(), z.date()]).optional(),
  sessionStatus: z.enum(['valid', 'expired', 'created']),
  status: z.object({
    chargesEnabled: z.boolean(),
    payoutsEnabled: z.boolean(),
    detailsSubmitted: z.boolean(),
  }),
});

export const getAccountResponseSchema = z.object({
  accountId: z.string(),
  status: z.object({
    chargesEnabled: z.boolean(),
    payoutsEnabled: z.boolean(),
    detailsSubmitted: z.boolean(),
    isActive: z.boolean(),
  }),
  requirements: z.any().optional(),
  onboardingCompletedAt: z.string().nullable(),
});

export const createSessionResponseSchema = z.object({
  clientSecret: z.string(),
  expiresAt: z.number(),
});

export const webhookResponseSchema = z.object({
  received: z.boolean(),
  alreadyProcessed: z.boolean().optional(),
});

// Export types
export type StripeConnectedAccount =
  typeof stripeConnectedAccounts.$inferSelect;
export type NewStripeConnectedAccount =
  typeof stripeConnectedAccounts.$inferInsert;
export type StripeAccountSession = typeof stripeAccountSessions.$inferSelect;
export type NewStripeAccountSession = typeof stripeAccountSessions.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;

export type CreateAccountRequest = z.infer<typeof createAccountRequestSchema>;
export type CreateAccountResponse = z.infer<typeof createAccountResponseSchema>;
export type GetAccountResponse = z.infer<typeof getAccountResponseSchema>;
export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>;
export type WebhookResponse = z.infer<typeof webhookResponseSchema>;
