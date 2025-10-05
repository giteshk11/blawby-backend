import { eq } from 'drizzle-orm';
import { db } from '@/database';
import { stripeSubscriptions } from '../schema';
import {
  insertStripeSubscriptionSchema,
  type InsertStripeSubscription,
} from '../../types';

type CreateStripeSubscription = InsertStripeSubscription;
type UpdateStripeSubscription = Partial<CreateStripeSubscription>;

// Create a new subscription
export const createSubscription = async (data: CreateStripeSubscription) => {
  // Validate input data using Drizzle-generated schema
  const validatedData = insertStripeSubscriptionSchema.parse(data);

  const [subscription] = await db
    .insert(stripeSubscriptions)
    .values(validatedData)
    .returning();
  return subscription;
};

// Get subscription by Stripe subscription ID
export const getSubscriptionByStripeId = async (
  stripeSubscriptionId: string,
) => {
  const [subscription] = await db
    .select()
    .from(stripeSubscriptions)
    .where(eq(stripeSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return subscription;
};

// Get subscription by customer ID
export const getSubscriptionByCustomerId = async (stripeCustomerId: string) => {
  const [subscription] = await db
    .select()
    .from(stripeSubscriptions)
    .where(eq(stripeSubscriptions.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return subscription;
};

// Get subscriptions by connected account ID
export const getSubscriptionsByConnectedAccountId = async (
  connectedAccountId: string,
) => {
  return await db
    .select()
    .from(stripeSubscriptions)
    .where(eq(stripeSubscriptions.connectedAccountId, connectedAccountId));
};

// Update subscription
export const updateSubscription = async (
  id: string,
  data: UpdateStripeSubscription,
) => {
  // Validate input data using Drizzle-generated schema
  const validatedData = insertStripeSubscriptionSchema.partial().parse(data);

  const [subscription] = await db
    .update(stripeSubscriptions)
    .set({
      ...validatedData,
      updatedAt: new Date(),
    })
    .where(eq(stripeSubscriptions.id, id))
    .returning();
  return subscription;
};

// Get subscription by ID
export const getSubscriptionById = async (id: string) => {
  const [subscription] = await db
    .select()
    .from(stripeSubscriptions)
    .where(eq(stripeSubscriptions.id, id))
    .limit(1);
  return subscription;
};

// Get all subscriptions (admin)
export const getAllSubscriptions = async (limit = 100, offset = 0) => {
  return await db
    .select()
    .from(stripeSubscriptions)
    .limit(limit)
    .offset(offset);
};

// Check if subscription exists
export const hasSubscription = async (
  stripeSubscriptionId: string,
): Promise<boolean> => {
  const [subscription] = await db
    .select({ id: stripeSubscriptions.id })
    .from(stripeSubscriptions)
    .where(eq(stripeSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return !!subscription;
};

// Get subscriptions by status
export const getSubscriptionsByStatus = async (status: string) => {
  return await db
    .select()
    .from(stripeSubscriptions)
    .where(eq(stripeSubscriptions.status, status));
};

// Delete subscription
export const deleteSubscription = async (id: string) => {
  await db.delete(stripeSubscriptions).where(eq(stripeSubscriptions.id, id));
};
