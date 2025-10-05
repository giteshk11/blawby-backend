import { getStripeClient } from './stripe-client';
import {
  createConnectedAccount,
  getConnectedAccountByEntity,
  getConnectedAccountByStripeId,
  updateConnectedAccount,
} from 'features/stripe/database/queries';

export type AccountData = {
  entityType: string;
  entityId: string;
  email?: string;
  country?: string;
};

export type AccountSessionData = {
  accountId: string;
  organizationData?: {
    name?: string;
    email?: string;
    country?: string;
  };
};

/**
 * Create a new Stripe connected account using blawby's advanced method
 */
export const createAccount = async function createAccount(
  data: AccountData,
): Promise<any> {
  // Create new Stripe connected account using blawby's advanced method
  const stripe = getStripeClient();
  const stripeAccount = await stripe.accounts.create({
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

  // Save to database
  const connectedAccount = await createConnectedAccount({
    stripeAccountId: stripeAccount.id,
    type: 'standard', // Standard account, not Express
    country: data.country || 'US',
    email: data.email || 'onboarding@organization.com',
    businessType: 'company',
    entityType: data.entityType,
    entityId: data.entityId,
    chargesEnabled: stripeAccount.charges_enabled || false,
    payoutsEnabled: stripeAccount.payouts_enabled || false,
    detailsSubmitted: stripeAccount.details_submitted || false,
  });

  return connectedAccount;
};

/**
 * Get or create Stripe connected account for an entity
 */
export const getOrCreateAccount = async function getOrCreateAccount(
  entityType: string,
  entityId: string,
  email?: string,
  country?: string,
): Promise<any> {
  // Check if entity already has a connected account
  const existingAccount = await getConnectedAccountByEntity(
    entityType,
    entityId,
  );

  if (existingAccount) {
    return existingAccount;
  }

  // Create new account
  return await createAccount({
    entityType,
    entityId,
    email,
    country,
  });
};

/**
 * Get account details from Stripe and update local database
 */
export const refreshAccountDetails = async function refreshAccountDetails(
  accountId: string,
): Promise<any> {
  const stripe = getStripeClient();

  // Get account from database
  const account = await getConnectedAccountByStripeId(accountId);
  if (!account) {
    throw new Error('Account not found');
  }

  // Get fresh data from Stripe
  const stripeAccount = await stripe.accounts.retrieve(accountId);

  // Update local data
  const updatedAccount = await updateConnectedAccount(account.id, {
    chargesEnabled: stripeAccount.charges_enabled || false,
    payoutsEnabled: stripeAccount.payouts_enabled || false,
    detailsSubmitted: stripeAccount.details_submitted || false,
    company: stripeAccount.company
      ? JSON.parse(JSON.stringify(stripeAccount.company))
      : null,
    individual: stripeAccount.individual
      ? JSON.parse(JSON.stringify(stripeAccount.individual))
      : null,
    requirements: stripeAccount.requirements
      ? JSON.parse(JSON.stringify(stripeAccount.requirements))
      : null,
    capabilities: stripeAccount.capabilities
      ? JSON.parse(JSON.stringify(stripeAccount.capabilities))
      : null,
  });

  return updatedAccount;
};

/**
 * Create login link for existing connected account
 */
export const createLoginLink = async function createLoginLink(
  accountId: string,
): Promise<any> {
  const stripe = getStripeClient();

  return await stripe.accounts.createLoginLink(accountId);
};

/**
 * Create account link for onboarding
 */
export const createAccountLink = async function createAccountLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string,
): Promise<any> {
  const stripe = getStripeClient();

  return await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
};
