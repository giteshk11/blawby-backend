import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Drizzle table definition
export const practiceDetails = pgTable('practice_details', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  userId: uuid('user_id').notNull(),
  businessPhone: text('business_phone'),
  businessEmail: text('business_email'),
  consultationFee: text('consultation_fee'),
  paymentUrl: text('payment_url'),
  calendlyUrl: text('calendly_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Practice details schemas (inferred from database with custom validation)
export const insertPracticeDetailsSchema = createInsertSchema(practiceDetails, {
  businessPhone: z
    .string()
    .regex(/^\+?[\d\s-()]+$/, 'Invalid phone format')
    .optional(),
  businessEmail: z.email('Invalid email format').optional(),
  consultationFee: z
    .string()
    .regex(/^\$\d+(\.\d{2})?$/, 'Invalid fee format (use $XX.XX)')
    .optional(),
  paymentUrl: z.url('Invalid payment URL').optional().or(z.literal('')),
  calendlyUrl: z.url('Invalid Calendly URL').optional().or(z.literal('')),
}).omit({
  id: true,
  organizationId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePracticeDetailsSchema =
  insertPracticeDetailsSchema.partial();

export const selectPracticeDetailsSchema = createSelectSchema(practiceDetails);

// Complete practice schemas = Better Auth org + practice details
export const insertPracticeSchema = z.object({
  // Better Auth organization fields (required)
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(100, 'Name too long'),
  slug: z
    .string()
    .min(1, 'Organization slug is required')
    .max(50, 'Slug too long')
    .regex(
      /^[a-z0-9-]+$/,
      'Slug must contain only lowercase letters, numbers, and hyphens',
    ),
  logo: z.url('Invalid logo URL').optional().or(z.literal('')),
  metadata: z.record(z.string(), z.any()).optional(),

  // Practice details (inferred from database schema)
  ...insertPracticeDetailsSchema.shape,
});

export const updatePracticeSchema = z.object({
  // Better Auth organization fields (all optional for updates)
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(100, 'Name too long')
    .optional(),
  slug: z
    .string()
    .min(1, 'Organization slug is required')
    .max(50, 'Slug too long')
    .regex(
      /^[a-z0-9-]+$/,
      'Slug must contain only lowercase letters, numbers, and hyphens',
    )
    .optional(),
  logo: z.string().url('Invalid logo URL').optional().or(z.literal('')),
  metadata: z.record(z.string(), z.any()).optional(),

  // Practice details (inferred from database schema)
  ...insertPracticeDetailsSchema.shape,
});

// Infer types from schemas
export type InsertPracticeRequest = z.infer<typeof insertPracticeSchema>;
export type UpdatePracticeRequest = z.infer<typeof updatePracticeSchema>;
export type SelectPracticeRequest = z.infer<typeof selectPracticeDetailsSchema>;
export type InsertPracticeDetails = z.infer<typeof insertPracticeDetailsSchema>;
export type UpdatePracticeDetails = z.infer<typeof updatePracticeDetailsSchema>;
export type SelectPracticeDetails = z.infer<typeof selectPracticeDetailsSchema>;
