import Stripe from 'stripe';
import type { FastifyInstance } from 'fastify';
import {
  getStripeAccounts,
  getStripeAccountSessions,
} from '@/modules/onboarding/services/stripe-client.service';
import {
  findByOrganization,
  findByStripeId,
  createStripeConnectedAccount,
  updateStripeConnectedAccountByStripeId,
  updateLastRefreshed,
} from '@/modules/onboarding/repositories/onboarding.repository';
import type {
  StripeConnectedAccount,
  NewStripeConnectedAccount,
  CreateAccountResponse,
  GetAccountResponse,
  CreateSessionResponse,
  CompanyInfo,
  IndividualInfo,
  Requirements,
  Capabilities,
  ExternalAccounts,
} from '@/modules/onboarding/schemas/onboarding.schema';

export const createOrGetAccount = async (
  fastify: FastifyInstance,
  organizationId: string,
  email: string,
): Promise<CreateAccountResponse> => {
  // Check if account exists for organization
  let account = await findByOrganization(fastify.db, organizationId);

  if (account) {
    // Generate new account session for existing account
    const session = await createOnboardingSession(
      fastify,
      account.stripeAccountId,
    );
    return {
      accountId: account.stripeAccountId,
      clientSecret: session.clientSecret,
      expiresAt: session.expiresAt,
      status: {
        chargesEnabled: account.chargesEnabled,
        payoutsEnabled: account.payoutsEnabled,
        detailsSubmitted: account.detailsSubmitted,
      },
    };
  }

  // Create new Stripe account
  const stripeAccount = await getStripeAccounts().create({
    country: 'US',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
      us_bank_account_ach_payments: { requested: true },
    },
    controller: {
      fees: { payer: 'application' },
      stripe_dashboard: { type: 'none' },
    },
  });

  // Save to database
  const newAccount: NewStripeConnectedAccount = {
    organizationId,
    stripeAccountId: stripeAccount.id,
    accountType: 'custom',
    country: 'US',
    email,
    chargesEnabled: stripeAccount.charges_enabled,
    payoutsEnabled: stripeAccount.payouts_enabled,
    detailsSubmitted: stripeAccount.details_submitted,
    businessType: stripeAccount.business_type,
    company: stripeAccount.company as CompanyInfo | undefined,
    individual: stripeAccount.individual as IndividualInfo | undefined,
    requirements: stripeAccount.requirements as Requirements | undefined,
    capabilities: stripeAccount.capabilities as Capabilities | undefined,
    externalAccounts: stripeAccount.external_accounts as
      | ExternalAccounts
      | undefined,
    metadata: stripeAccount.metadata as Record<string, string> | undefined,
    lastRefreshedAt: new Date(),
  };

  account = await createStripeConnectedAccount(fastify.db, newAccount);

  // Generate account session
  const session = await createOnboardingSession(fastify, stripeAccount.id);

  return {
    accountId: stripeAccount.id,
    clientSecret: session.clientSecret,
    expiresAt: session.expiresAt,
    status: {
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      detailsSubmitted: account.detailsSubmitted,
    },
  };
};

export const createOnboardingSession = async (
  fastify: FastifyInstance,
  stripeAccountId: string,
): Promise<CreateSessionResponse> => {
  const session = await getStripeAccountSessions().create({
    account: stripeAccountId,
    components: {
      account_onboarding: {
        enabled: true,
      },
    },
  });

  // Update last refreshed timestamp
  await updateLastRefreshed(fastify.db, stripeAccountId);

  return {
    clientSecret: session.client_secret,
    expiresAt: session.expires_at,
  };
};

export const createPaymentsSession = async (
  fastify: FastifyInstance,
  stripeAccountId: string,
): Promise<CreateSessionResponse> => {
  const session = await getStripeAccountSessions().create({
    account: stripeAccountId,
    components: {
      payments: {
        enabled: true,
        features: {
          refund_management: true,
          dispute_management: true,
          capture_payments: true,
        },
      },
    },
  });

  // Update last refreshed timestamp
  await updateLastRefreshed(fastify.db, stripeAccountId);

  return {
    clientSecret: session.client_secret,
    expiresAt: session.expires_at,
  };
};

export const getAccount = async (
  fastify: FastifyInstance,
  organizationId: string,
): Promise<GetAccountResponse | null> => {
  const account = await findByOrganization(fastify.db, organizationId);

  if (!account) {
    return null;
  }

  const isActive = isAccountActive(account);

  return {
    accountId: account.stripeAccountId,
    status: {
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      detailsSubmitted: account.detailsSubmitted,
      isActive,
    },
    requirements: account.requirements,
    onboardingCompletedAt: account.onboardingCompletedAt?.toISOString() || null,
  };
};

export const isAccountActive = (account: StripeConnectedAccount): boolean => {
  // Check if charges and payouts are enabled
  if (!account.chargesEnabled || !account.payoutsEnabled) {
    return false;
  }

  // Check if requirements are met
  if (account.requirements) {
    const { currently_due, eventually_due, past_due } = account.requirements;
    if (
      currently_due.length > 0 ||
      eventually_due.length > 0 ||
      past_due.length > 0
    ) {
      return false;
    }
  }

  return true;
};

export const handleAccountUpdated = async (
  fastify: FastifyInstance,
  stripeAccountId: string,
  accountData: Stripe.Account,
): Promise<void> => {
  const account = await findByStripeId(fastify.db, stripeAccountId);

  if (!account) {
    fastify.log.warn(`Account not found for Stripe ID: ${stripeAccountId}`);
    return;
  }

  // Update account data
  const updateData: Partial<NewStripeConnectedAccount> = {
    chargesEnabled: accountData.charges_enabled,
    payoutsEnabled: accountData.payouts_enabled,
    detailsSubmitted: accountData.details_submitted,
    businessType: accountData.business_type,
    company: accountData.company as CompanyInfo | undefined,
    individual: accountData.individual as IndividualInfo | undefined,
    requirements: accountData.requirements as Requirements | undefined,
    capabilities: accountData.capabilities as Capabilities | undefined,
    externalAccounts: accountData.external_accounts as
      | ExternalAccounts
      | undefined,
    metadata: accountData.metadata as Record<string, string> | undefined,
  };

  // If details are submitted and onboarding wasn't completed before, mark as completed
  if (accountData.details_submitted && !account.onboardingCompletedAt) {
    updateData.onboardingCompletedAt = new Date();
    fastify.log.info(`Onboarding completed for account: ${stripeAccountId}`);
  }

  await updateStripeConnectedAccountByStripeId(
    fastify.db,
    stripeAccountId,
    updateData,
  );
};
