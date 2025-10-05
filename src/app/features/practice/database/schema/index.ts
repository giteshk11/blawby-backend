import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Practice Details table - stores practice-specific business information
export const practiceDetails = pgTable('practice_details', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: text('organization_id').notNull().unique(), // References Better Auth organization.id
  businessPhone: text('business_phone'),
  businessEmail: text('business_email'),
  consultationFee: text('consultation_fee'),
  paymentUrl: text('payment_url'),
  calendlyUrl: text('calendly_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Export schema object for Drizzle
export const practiceSchema = {
  practiceDetails,
};
