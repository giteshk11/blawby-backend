import { getStripeClient } from './stripe-client';
import {
  createCustomer,
  getCustomerByStripeId,
  updateCustomer,
  deleteCustomer,
} from 'features/stripe/database/queries';

export type CustomerData = {
  name: string;
  email: string;
  currency?: string;
  metadata?: Record<string, string>;
};

/**
 * Create a new Stripe customer
 */
export const createStripeCustomer = async function createStripeCustomer(
  data: CustomerData,
): Promise<any> {
  const stripe = getStripeClient();

  // Create customer in Stripe
  const stripeCustomer = await stripe.customers.create({
    name: data.name,
    email: data.email,
    currency: data.currency || 'USD',
    metadata: data.metadata,
  });

  // Save to database
  const customer = await createCustomer({
    name: data.name,
    email: data.email,
    currency: data.currency || 'USD',
    stripeCustomerId: stripeCustomer.id,
  });

  return customer;
};

/**
 * Get customer details from Stripe and update local database
 */
export const refreshCustomerDetails = async function refreshCustomerDetails(
  customerId: string,
): Promise<any> {
  const stripe = getStripeClient();

  // Get customer from database
  const customer = await getCustomerByStripeId(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  // Get fresh data from Stripe
  const stripeCustomer = await stripe.customers.retrieve(customerId);

  // Update local data
  const updatedCustomer = await updateCustomer(customer.id, {
    name: stripeCustomer.name || customer.name,
    email: stripeCustomer.email || customer.email,
    currency: stripeCustomer.currency || customer.currency,
  });

  return updatedCustomer;
};

/**
 * Update customer in Stripe and local database
 */
export const updateStripeCustomer = async function updateStripeCustomer(
  customerId: string,
  data: Partial<CustomerData>,
): Promise<any> {
  const stripe = getStripeClient();

  // Update customer in Stripe
  const stripeCustomer = await stripe.customers.update(customerId, {
    name: data.name,
    email: data.email,
    metadata: data.metadata,
  });

  // Update local database
  const customer = await getCustomerByStripeId(customerId);
  if (customer) {
    const updatedCustomer = await updateCustomer(customer.id, {
      name: data.name,
      email: data.email,
    });
    return updatedCustomer;
  }

  return stripeCustomer;
};

/**
 * Delete customer from Stripe and local database
 */
export const deleteStripeCustomer = async function deleteStripeCustomer(
  customerId: string,
): Promise<void> {
  const stripe = getStripeClient();

  // Delete from Stripe
  await stripe.customers.del(customerId);

  // Delete from local database
  const customer = await getCustomerByStripeId(customerId);
  if (customer) {
    await deleteCustomer(customer.id);
  }
};
