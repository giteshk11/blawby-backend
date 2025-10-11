import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  customers,
  type Customer,
  type NewCustomer,
} from '@/modules/stripe/schemas/customers.schema';

export const findByEmail = async (
  db: NodePgDatabase,
  email: string,
): Promise<Customer | null> => {
  const customerList = await db
    .select()
    .from(customers)
    .where(eq(customers.email, email))
    .limit(1);

  return customerList[0] || null;
};

export const findByStripeId = async (
  db: NodePgDatabase,
  stripeCustomerId: string,
): Promise<Customer | null> => {
  const customerList = await db
    .select()
    .from(customers)
    .where(eq(customers.stripeCustomerId, stripeCustomerId))
    .limit(1);

  return customerList[0] || null;
};

export const findById = async (
  db: NodePgDatabase,
  id: string,
): Promise<Customer | null> => {
  const customerList = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);

  return customerList[0] || null;
};

export const findByOrganization = async (
  db: NodePgDatabase,
  organizationId: string,
): Promise<Customer[]> => {
  return await db
    .select()
    .from(customers)
    .where(eq(customers.organizationId, organizationId));
};

export const createCustomer = async (
  db: NodePgDatabase,
  data: NewCustomer,
): Promise<Customer> => {
  const [customer] = await db
    .insert(customers)
    .values({
      ...data,
      updatedAt: new Date(),
    })
    .returning();

  return customer;
};

export const updateCustomer = async (
  db: NodePgDatabase,
  id: string,
  data: Partial<NewCustomer>,
): Promise<Customer> => {
  const [customer] = await db
    .update(customers)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, id))
    .returning();

  return customer;
};

export const updateCustomerByStripeId = async (
  db: NodePgDatabase,
  stripeCustomerId: string,
  data: Partial<NewCustomer>,
): Promise<Customer> => {
  const [customer] = await db
    .update(customers)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(customers.stripeCustomerId, stripeCustomerId))
    .returning();

  return customer;
};
