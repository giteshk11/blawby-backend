import * as tables from 'src/database/index';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// TypeScript types for Better Auth tables
export type User = typeof tables.users.$inferSelect;
export type InsertUser = typeof tables.users.$inferInsert;

export type Session = typeof tables.sessions.$inferSelect;
export type InsertSession = typeof tables.sessions.$inferInsert;

export type Account = typeof tables.accounts.$inferSelect;
export type InsertAccount = typeof tables.accounts.$inferInsert;

export type Verification = typeof tables.verifications.$inferSelect;
export type InsertVerification = typeof tables.verifications.$inferInsert;

export type Organization = typeof tables.organizations.$inferSelect;
export type InsertOrganization = typeof tables.organizations.$inferInsert;

export type Member = typeof tables.members.$inferSelect;
export type InsertMember = typeof tables.members.$inferInsert;

// Zod schemas for Better Auth tables
export const insertUserSchema = createInsertSchema(tables.users);
export const selectUserSchema = createSelectSchema(tables.users);

export const insertSessionSchema = createInsertSchema(tables.sessions);
export const selectSessionSchema = createSelectSchema(tables.sessions);

export const insertAccountSchema = createInsertSchema(tables.accounts);
export const selectAccountSchema = createSelectSchema(tables.accounts);

export const insertVerificationSchema = createInsertSchema(
  tables.verifications,
);
export const selectVerificationSchema = createSelectSchema(
  tables.verifications,
);

export const insertOrganizationSchema = createInsertSchema(
  tables.organizations,
);
export const selectOrganizationSchema = createSelectSchema(
  tables.organizations,
);

export const insertMemberSchema = createInsertSchema(tables.members);
export const selectMemberSchema = createSelectSchema(tables.members);
