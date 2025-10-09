import { billingRepository } from '@/modules/billing/repositories/billing.repository';
import { CreateOnboardingSessionRequest } from '@/shared/validations/billing';
import type { FastifyInstance } from 'fastify';

type User = {
  id: string;
  email: string;
};

type CreatePaymentsSessionDto = {
  organizationId: string;
};

type CreateLoginLinkDto = {
  organizationId: string;
};

type CreateOnboardingSessionDto = CreateOnboardingSessionRequest;

// Onboarding
export const createOnboardingSession = async (
  data: CreateOnboardingSessionDto,
  _user: User,
  _fastify: FastifyInstance,
) => {
  // Check if organization already has a connected account
  let connectedAccount =
    await billingRepository.findConnectedAccountByOrganization(
      data.organizationId,
    );

  let isNewAccount = false;

  if (!connectedAccount) {
    // Create new Stripe account
    const stripeAccount = await createStripeAccount(data);

    // Save to database
    connectedAccount = await billingRepository.createConnectedAccount({
      organizationId: data.organizationId,
      accountId: stripeAccount.id,
      status: 'pending',
      onboardingStatus: 'incomplete',
      requirements: stripeAccount.requirements,
      capabilities: stripeAccount.capabilities,
      chargesEnabled: stripeAccount.charges_enabled,
      payoutsEnabled: stripeAccount.payouts_enabled,
    });

    isNewAccount = true;
  }

  // Create Account Session for embedded components
  const accountSession = await createAccountSession(
    connectedAccount.accountId,
    data,
  );

  // Save session to database
  await billingRepository.createOnboardingSession({
    connectedAccountId: connectedAccount.id,
    sessionId: accountSession.id,
    status: 'pending',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  });

  return {
    accountId: connectedAccount.accountId,
    clientSecret: accountSession.client_secret,
    accountSessionId: accountSession.id,
    onboardingUrl: accountSession.onboarding_url,
    refreshUrl: data.refreshUrl,
    returnUrl: data.returnUrl,
    isNewAccount,
  };
};

export const getOnboardingStatus = async (
  organizationId: string,
  _user: User,
  _fastify: FastifyInstance,
) => {
  const connectedAccount =
    await billingRepository.findConnectedAccountByOrganization(organizationId);

  if (!connectedAccount) {
    return {
      hasAccount: false,
      onboardingComplete: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    };
  }

  // Get fresh data from Stripe
  const stripeAccount = await getStripeAccount(connectedAccount.accountId);

  // Update local data
  await billingRepository.updateConnectedAccount(organizationId, {
    status: stripeAccount.details_submitted ? 'active' : 'pending',
    onboardingStatus: stripeAccount.onboarding_status,
    requirements: stripeAccount.requirements,
    capabilities: stripeAccount.capabilities,
    chargesEnabled: stripeAccount.charges_enabled,
    payoutsEnabled: stripeAccount.payouts_enabled,
  });

  return {
    hasAccount: true,
    accountId: connectedAccount.accountId,
    onboardingComplete: stripeAccount.details_submitted,
    chargesEnabled: stripeAccount.charges_enabled,
    payoutsEnabled: stripeAccount.payouts_enabled,
    requirements: stripeAccount.requirements,
    capabilities: stripeAccount.capabilities,
    account: connectedAccount,
  };
};

export const createPaymentsSession = async (
  data: CreatePaymentsSessionDto,
  _user: User,
  fastify: FastifyInstance,
) => {
  const connectedAccount =
    await billingRepository.findConnectedAccountByOrganization(
      data.organizationId,
    );

  if (!connectedAccount) {
    throw fastify.httpErrors.notFound(
      'No connected account found for organization',
    );
  }

  // Create payments session for embedded components
  const session = await createStripePaymentsSession(connectedAccount.accountId);

  return {
    client_secret: session.client_secret,
    id: session.id,
  };
};

export const createLoginLink = async (
  data: CreateLoginLinkDto,
  _user: User,
  fastify: FastifyInstance,
) => {
  const connectedAccount =
    await billingRepository.findConnectedAccountByOrganization(
      data.organizationId,
    );

  if (!connectedAccount) {
    throw fastify.httpErrors.notFound(
      'No connected account found for organization',
    );
  }

  // Create login link
  const loginLink = await createStripeLoginLink(connectedAccount.accountId);

  return {
    url: loginLink.url,
  };
};

// Private helper functions for Stripe API calls
const createStripeAccount = async (_data: CreateOnboardingSessionDto) => {
  // This would use the Stripe SDK
  // For now, return mock data
  return {
    id: `acct_${Math.random().toString(36).substr(2, 9)}`,
    details_submitted: false,
    onboarding_status: 'incomplete',
    requirements: {},
    capabilities: {},
    charges_enabled: false,
    payouts_enabled: false,
  };
};

const createAccountSession = async (
  accountId: string,
  _data: CreateOnboardingSessionDto,
) => {
  // This would use the Stripe SDK
  // For now, return mock data
  return {
    id: `acsess_${Math.random().toString(36).substr(2, 9)}`,
    client_secret: `acs_client_secret_${Math.random().toString(36).substr(2, 9)}`,
    onboarding_url: `https://connect.stripe.com/setup/c/${accountId}`,
  };
};

const getStripeAccount = async (accountId: string) => {
  // This would use the Stripe SDK
  // For now, return mock data
  return {
    id: accountId,
    details_submitted: true,
    onboarding_status: 'complete',
    requirements: {},
    capabilities: {},
    charges_enabled: true,
    payouts_enabled: true,
  };
};

const createStripePaymentsSession = async (_accountId: string) => {
  // This would use the Stripe SDK
  // For now, return mock data
  return {
    id: `ps_${Math.random().toString(36).substr(2, 9)}`,
    client_secret: `ps_client_secret_${Math.random().toString(36).substr(2, 9)}`,
  };
};

const createStripeLoginLink = async (accountId: string) => {
  // This would use the Stripe SDK
  // For now, return mock data
  return {
    url: `https://connect.stripe.com/login/${accountId}`,
  };
};
