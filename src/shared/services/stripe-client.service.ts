/**
 * Stripe Client Service
 *
 * Simple Stripe client utilities
 */

import Stripe from 'stripe';

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

/**
 * Get Stripe client instance
 */
export const getStripeClient = function getStripeClient(): Stripe {
  return stripe;
};

/**
 * Get Stripe customers
 */
export const getStripeCustomers = function getStripeCustomers(
  limit: number = 10,
  startingAfter?: string,
): Promise<Stripe.ApiList<Stripe.Customer>> {
  return stripe.customers.list({
    limit,
    starting_after: startingAfter,
  });
};
