import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import * as schema from '../schema';
import { config } from '@dotenvx/dotenvx';

// Load environment variables
config();

// Validate DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create the connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create the Drizzle database instance
export const db = drizzle(pool, { schema });

// Export individual tables for convenience
export const {
  users,
  sessions,
  accounts,
  verifications,
  organizations,
  members,
} = schema;

// Export Zod schemas generated from Drizzle tables
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertSessionSchema = createInsertSchema(sessions);
export const selectSessionSchema = createSelectSchema(sessions);

export const insertAccountSchema = createInsertSchema(accounts);
export const selectAccountSchema = createSelectSchema(accounts);

export const insertVerificationSchema = createInsertSchema(verifications);
export const selectVerificationSchema = createSelectSchema(verifications);

export const insertOrganizationSchema = createInsertSchema(organizations);
export const selectOrganizationSchema = createSelectSchema(organizations);

export const insertMemberSchema = createInsertSchema(members);
export const selectMemberSchema = createSelectSchema(members);
