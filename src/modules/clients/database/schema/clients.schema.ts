import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import {
  createInsertSchema,
  createSelectSchema,
  jsonSchema,
} from 'drizzle-zod';
import { z } from 'zod';
import { organizations, users } from '@/schema/better-auth-schema';

export type ClientAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

// Clients (organization's external clients who get invoiced)
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations (optional)
  userId: text('user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
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
  address: jsonb('address').$type<ClientAddress>(),

  // Payment Methods
  defaultPaymentMethodId: text('default_payment_method_id'),

  // Metadata
  metadata: jsonb('metadata').$type<typeof jsonSchema>(),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Zod schemas for validation
export const insertClientSchema = createInsertSchema(clients, {
  email: z.email(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Select schemas
export const selectClientSchema = createSelectSchema(clients);

// Type exports
export type InsertClient = z.infer<typeof insertClientSchema>;
export type SelectClient = z.infer<typeof selectClientSchema>;

// Legacy exports for backward compatibility during migration
export const clientsAsCustomers = clients;
export const insertCustomerSchema = insertClientSchema;
export const selectCustomerSchema = selectClientSchema;
export type InsertCustomer = InsertClient;
export type SelectCustomer = SelectClient;

// Indexes will be added in a separate migration

// Main exports (use these going forward)
export { clients as default };
