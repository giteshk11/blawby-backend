import * as tables from '../database/schema';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// TypeScript types for Better Auth tables
export type User = typeof tables.user.$inferSelect;
export type InsertUser = typeof tables.user.$inferInsert;

export type Session = typeof tables.session.$inferSelect;
export type InsertSession = typeof tables.session.$inferInsert;

export type Account = typeof tables.account.$inferSelect;
export type InsertAccount = typeof tables.account.$inferInsert;

export type Verification = typeof tables.verification.$inferSelect;
export type InsertVerification = typeof tables.verification.$inferInsert;

export type Organization = typeof tables.organization.$inferSelect;
export type InsertOrganization = typeof tables.organization.$inferInsert;

export type Member = typeof tables.member.$inferSelect;
export type InsertMember = typeof tables.member.$inferInsert;

// Zod schemas for Better Auth tables
export const insertUserSchema = createInsertSchema(tables.user);
export const selectUserSchema = createSelectSchema(tables.user);

export const insertSessionSchema = createInsertSchema(tables.session);
export const selectSessionSchema = createSelectSchema(tables.session);

export const insertAccountSchema = createInsertSchema(tables.account);
export const selectAccountSchema = createSelectSchema(tables.account);

export const insertVerificationSchema = createInsertSchema(tables.verification);
export const selectVerificationSchema = createSelectSchema(tables.verification);

export const insertOrganizationSchema = createInsertSchema(tables.organization);
export const selectOrganizationSchema = createSelectSchema(tables.organization);

export const insertMemberSchema = createInsertSchema(tables.member);
export const selectMemberSchema = createSelectSchema(tables.member);




