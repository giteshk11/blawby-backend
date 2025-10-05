import { eq } from 'drizzle-orm';
import { db } from '@/database';
import { stripeCustomers } from '../schema';
import {
  insertStripeCustomerSchema,
  type InsertStripeCustomer,
} from 'features/stripe/types';

type CreateStripeCustomer = InsertStripeCustomer;
type UpdateStripeCustomer = Partial<CreateStripeCustomer>;

// Create a new customer
export const createCustomer = async (data: CreateStripeCustomer) => {
  // Validate input data using Drizzle-generated schema
  const validatedData = insertStripeCustomerSchema.parse(data);

  const [customer] = await db
    .insert(stripeCustomers)
    .values(validatedData)
    .returning();
  return customer;
};

// Get customer by email
export const getCustomerByEmail = async (email: string) => {
  const [customer] = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.email, email))
    .limit(1);
  return customer;
};

// Get customer by Stripe customer ID
export const getCustomerByStripeId = async (stripeCustomerId: string) => {
  const [customer] = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return customer;
};

// Update customer
export const updateCustomer = async (
  id: string,
  data: UpdateStripeCustomer,
) => {
  // Validate input data using Drizzle-generated schema
  const validatedData = insertStripeCustomerSchema.partial().parse(data);

  const [customer] = await db
    .update(stripeCustomers)
    .set({
      ...validatedData,
      updatedAt: new Date(),
    })
    .where(eq(stripeCustomers.id, id))
    .returning();
  return customer;
};

// Get customer by ID
export const getCustomerById = async (id: string) => {
  const [customer] = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.id, id))
    .limit(1);
  return customer;
};

// Get all customers (admin)
export const getAllCustomers = async (limit = 100, offset = 0) => {
  return await db.select().from(stripeCustomers).limit(limit).offset(offset);
};

// Check if customer exists
export const hasCustomer = async (
  stripeCustomerId: string,
): Promise<boolean> => {
  const [customer] = await db
    .select({ id: stripeCustomers.id })
    .from(stripeCustomers)
    .where(eq(stripeCustomers.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return !!customer;
};

// Delete customer
export const deleteCustomer = async (id: string) => {
  await db.delete(stripeCustomers).where(eq(stripeCustomers.id, id));
};
