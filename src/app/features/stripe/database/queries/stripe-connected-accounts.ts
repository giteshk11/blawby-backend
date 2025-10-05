import { and, eq } from 'drizzle-orm';
import { db } from '@/database';
import { stripeConnectedAccounts } from 'features/stripe/database/schema';
import {
  type InsertStripeConnectedAccount,
  insertStripeConnectedAccountSchema,
} from 'features/stripe/types';

type CreateStripeConnectedAccount = InsertStripeConnectedAccount;
type UpdateStripeConnectedAccount = Partial<CreateStripeConnectedAccount>;

// Create a new Stripe connected account record
export const createConnectedAccount = async (
  data: CreateStripeConnectedAccount,
) => {
  // Validate input data using Drizzle-generated schema
  const validatedData = insertStripeConnectedAccountSchema.parse(data);

  const [account] = await db
    .insert(stripeConnectedAccounts)
    .values(validatedData)
    .returning();

  return account;
};

// Get connected account by Stripe account ID
export const getConnectedAccountByStripeId = async (
  stripeAccountId: string,
) => {
  const [account] = await db
    .select()
    .from(stripeConnectedAccounts)
    .where(eq(stripeConnectedAccounts.stripeAccountId, stripeAccountId))
    .limit(1);

  return account;
};

// Get connected account by entity (organization/team)
export const getConnectedAccountByEntity = async (
  entityType: string,
  entityId: string,
) => {
  const [account] = await db
    .select()
    .from(stripeConnectedAccounts)
    .where(
      and(
        eq(stripeConnectedAccounts.entityType, entityType),
        eq(stripeConnectedAccounts.entityId, entityId),
      ),
    )
    .limit(1);

  return account;
};

// Get connected account by entity ID (convenience method for organization)
export const getConnectedAccountByEntityId = async (entityId: string) => {
  const [account] = await db
    .select()
    .from(stripeConnectedAccounts)
    .where(eq(stripeConnectedAccounts.entityId, entityId))
    .limit(1);

  return account;
};

// Update connected account
export const updateConnectedAccount = async (
  id: string,
  data: UpdateStripeConnectedAccount,
) => {
  // Validate input data using Drizzle-generated schema
  const validatedData = insertStripeConnectedAccountSchema
    .partial()
    .parse(data);

  const [account] = await db
    .update(stripeConnectedAccounts)
    .set({
      ...validatedData,
      updatedAt: new Date(),
    })
    .where(eq(stripeConnectedAccounts.id, id))
    .returning();

  return account;
};

// Get all connected accounts for an entity type
export const getConnectedAccountsByEntityType = async (entityType: string) => {
  return await db
    .select()
    .from(stripeConnectedAccounts)
    .where(eq(stripeConnectedAccounts.entityType, entityType));
};

// Get all connected accounts (admin)
export const getAllConnectedAccounts = async (limit = 100, offset = 0) => {
  return await db
    .select()
    .from(stripeConnectedAccounts)
    .limit(limit)
    .offset(offset);
};

// Check if connected account exists
export const hasConnectedAccount = async (
  stripeAccountId: string,
): Promise<boolean> => {
  const [account] = await db
    .select({ id: stripeConnectedAccounts.id })
    .from(stripeConnectedAccounts)
    .where(eq(stripeConnectedAccounts.stripeAccountId, stripeAccountId))
    .limit(1);

  return !!account;
};

// Delete connected account
export const deleteConnectedAccount = async (id: string) => {
  await db
    .delete(stripeConnectedAccounts)
    .where(eq(stripeConnectedAccounts.id, id));
};
