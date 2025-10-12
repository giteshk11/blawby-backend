import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { organizations } from '@/schema/better-auth-schema';
import { clients } from '@/modules/clients/database/schema/clients.schema';
import { stripeConnectedAccounts } from '@/modules/onboarding/schemas/onboarding.schema';

// Enums
export const invoiceTypeEnum = pgEnum('invoice_type', ['customer', 'platform']);
export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'open',
  'paid',
  'void',
  'uncollectible',
]);

// 1. Invoices
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  connectedAccountId: uuid('connected_account_id')
    .notNull()
    .references(() => stripeConnectedAccounts.id),

  // Stripe
  stripeInvoiceId: text('stripe_invoice_id').notNull().unique(),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeChargeId: text('stripe_charge_id'),

  // Invoice Info
  invoiceNumber: text('invoice_number').notNull().unique(),
  invoiceType: invoiceTypeEnum('invoice_type').notNull(),

  // Amounts (in cents)
  amountDue: integer('amount_due').notNull(),
  amountPaid: integer('amount_paid').notNull().default(0),
  amountRemaining: integer('amount_remaining').notNull(),
  currency: text('currency').notNull().default('usd'),

  // Fees
  applicationFee: integer('application_fee'),
  stripeFee: integer('stripe_fee'),
  netAmount: integer('net_amount'),

  // Status
  status: invoiceStatusEnum('status').notNull(),

  // Dates
  dueDate: timestamp('due_date'),
  paidAt: timestamp('paid_at'),
  voidedAt: timestamp('voided_at'),

  // Receipt
  receiptUrl: text('receipt_url'),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Invoice Line Items
export const invoiceLineItems = pgTable('invoice_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),

  // Item Info
  description: text('description').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: integer('unit_price').notNull(), // in cents
  lineTotal: integer('line_total').notNull(), // in cents

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Zod schemas for validation
export const insertInvoiceSchema = createInsertSchema(invoices, {
  invoiceNumber: z.string().min(1),
  currency: z.string().length(3),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceLineItemSchema = createInsertSchema(
  invoiceLineItems,
).omit({
  id: true,
  createdAt: true,
});

// Select schemas
export const selectInvoiceSchema = createSelectSchema(invoices);
export const selectInvoiceLineItemSchema = createSelectSchema(invoiceLineItems);

// Type exports
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type SelectInvoice = z.infer<typeof selectInvoiceSchema>;
export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;
export type SelectInvoiceLineItem = z.infer<typeof selectInvoiceLineItemSchema>;
