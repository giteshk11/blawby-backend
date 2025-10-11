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

export const getStripeInvoices = (): Stripe.InvoicesResource => {
  return getStripeInstance().invoices;
};

export const getStripePaymentIntents = (): Stripe.PaymentIntentsResource => {
  return getStripeInstance().paymentIntents;
};

export const getStripeTransfers = (): Stripe.TransfersResource => {
  return getStripeInstance().transfers;
};

export const getStripeCustomers = (): Stripe.CustomersResource => {
  return getStripeInstance().customers;
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
