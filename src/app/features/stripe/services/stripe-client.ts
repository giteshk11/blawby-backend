import Stripe from 'stripe';

/**
 * Get Stripe client instance
 */
export const getStripeClient = function getStripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-09-30.clover',
  });
};

/**
 * Create a Stripe Connect account with advanced configuration (from blawby)
 */
export const createAdvancedConnectedAccount =
  async function createAdvancedConnectedAccount(): Promise<Stripe.Account> {
    const stripe = getStripeClient();

    return await stripe.accounts.create({
      country: 'US',
      controller: {
        fees: { payer: 'application' },
        losses: { payments: 'stripe' },
        stripe_dashboard: { type: 'none' },
      },
      capabilities: {
        bank_transfer_payments: { requested: true },
        card_payments: { requested: true },
        us_bank_account_ach_payments: { requested: true },
        us_bank_transfer_payments: { requested: true },
        transfers: { requested: true },
      },
    });
  };

/**
 * Create account session for onboarding
 */
export const createAccountSession = async function createAccountSession(
  accountId: string,
  _organizationData?: {
    name?: string;
    email?: string;
    country?: string;
  },
): Promise<Stripe.AccountSession> {
  const stripe = getStripeClient();

  const sessionParams: Stripe.AccountSessionCreateParams = {
    account: accountId,
    components: {
      account_onboarding: {
        enabled: true,
      },
    },
  };

  return await stripe.accountSessions.create(sessionParams);
};

/**
 * Create account session for payments
 */
export const createPaymentsAccountSession =
  async function createPaymentsAccountSession(
    accountId: string,
  ): Promise<Stripe.AccountSession> {
    const stripe = getStripeClient();

    return await stripe.accountSessions.create({
      account: accountId,
      components: {
        payments: {
          enabled: true,
          features: {
            refund_management: true,
            dispute_management: true,
            capture_payments: true,
            destination_on_behalf_of_charge_management: false,
          },
        },
      },
    });
  };
