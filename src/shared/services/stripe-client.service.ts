/**
 * Stripe Client Service
 *
 * Simple Stripe client utilities
 */

import Stripe from 'stripe';

// Lazy initialization of Stripe client
let _stripe: Stripe | null = null;

/**
 * Get Stripe client instance (initializes on first call)
 */
export const getStripeClient = (): Stripe => {
  if (!_stripe) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    _stripe = new Stripe(apiKey, {
      apiVersion: '2025-09-30.clover',
    });
  }

  return _stripe;
};

/**
 * Get Stripe customers
 */
export const getStripeCustomers = (
  limit: number = 10,
  startingAfter?: string,
): Promise<Stripe.ApiList<Stripe.Customer>> => {
  return getStripeClient().customers.list({
    limit,
    starting_after: startingAfter,
  });
};
