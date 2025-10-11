import { pgTable, uuid, text, json, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { organizations, users } from '@/schema';

// Address type for customers
export type Address = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

// Customers table (NEW - separate entity)
export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations (optional)
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  organizationId: text('organization_id').references(() => organizations.id, {
    onDelete: 'set null',
  }),

  // Stripe
  stripeCustomerId: text('stripe_customer_id').notNull().unique(),

  // Customer Info
  email: text('email').notNull(),
  name: text('name'),
  phone: text('phone'),

  // Address
  address: json('address').$type<Address>(),

  // Payment Methods
  defaultPaymentMethodId: text('default_payment_method_id'),

  // Metadata
  metadata: json('metadata').$type<Record<string, any>>(),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Zod schemas for validation
export const createCustomerSchema = createInsertSchema(customers, {
  email: z.string().email('Invalid email format'),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const selectCustomerSchema = createSelectSchema(customers);

// Request/Response schemas
export const createCustomerRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().optional(),
  phone: z.string().optional(),
  address: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postal_code: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type CreateCustomerRequest = z.infer<typeof createCustomerRequestSchema>;

export const createCustomerResponseSchema = z.object({
  customerId: z.string(),
  stripeCustomerId: z.string(),
  email: z.string(),
  name: z.string().nullable(),
});

export type CreateCustomerResponse = z.infer<
  typeof createCustomerResponseSchema
>;

// Export types
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
