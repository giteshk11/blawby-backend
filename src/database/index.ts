import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import * as schema from '../schema';

// Create the connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create the Drizzle database instance
export const db = drizzle(pool, { schema });

// Export individual tables for convenience
export const { user, session, account, verification, organization, member } =
  schema;

// Export Zod schemas generated from Drizzle tables
export const insertUserSchema = createInsertSchema(user);
export const selectUserSchema = createSelectSchema(user);

export const insertSessionSchema = createInsertSchema(session);
export const selectSessionSchema = createSelectSchema(session);

export const insertAccountSchema = createInsertSchema(account);
export const selectAccountSchema = createSelectSchema(account);

export const insertVerificationSchema = createInsertSchema(verification);
export const selectVerificationSchema = createSelectSchema(verification);

export const insertOrganizationSchema = createInsertSchema(organization);
export const selectOrganizationSchema = createSelectSchema(organization);

export const insertMemberSchema = createInsertSchema(member);
export const selectMemberSchema = createSelectSchema(member);
