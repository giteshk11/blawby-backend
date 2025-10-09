import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

const getStripeInstance = (): Stripe => {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-09-30.clover',
    });
  }

  return stripeInstance;
};

export const getStripeClient = (): Stripe => {
  return getStripeInstance();
};

export const getStripeAccounts = (): Stripe.AccountsResource => {
  return getStripeInstance().accounts;
};

export const getStripeAccountSessions = (): Stripe.AccountSessionsResource => {
  return getStripeInstance().accountSessions;
};

export const constructWebhookEvent = (
  payload: string | Buffer,
  signature: string,
  secret: string,
): Stripe.Event => {
  return getStripeInstance().webhooks.constructEvent(
    payload,
    signature,
    secret,
  );
};
