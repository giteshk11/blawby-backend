import {
  createAdvancedConnectedAccount,
  createAccountSession,
  getStripeClient,
} from './stripe-client';
import {
  getConnectedAccountByEntityId,
  createConnectedAccount,
} from 'features/stripe/database/queries';

export type OnboardingData = {
  organizationId: string;
  organizationName?: string;
  organizationEmail?: string;
  country?: string;
  refreshUrl?: string;
  returnUrl?: string;
};

export type OnboardingSessionResponse = {
  accountId: string;
  clientSecret: string;
};

/**
 * Create Stripe onboarding session for an organization
 */
export const createOnboardingSession = async function createOnboardingSession(
  data: OnboardingData,
): Promise<OnboardingSessionResponse> {
  // Check if organization already has a connected account
  let connectedAccount = await getConnectedAccountByEntityId(
    data.organizationId,
  );

  let isNewAccount = false;

  if (!connectedAccount) {
    // Create new Stripe connected account using blawby's advanced method
    const stripeAccount = await createAdvancedConnectedAccount();

    // Save to database
    connectedAccount = await createConnectedAccount({
      stripeAccountId: stripeAccount.id,
      type: 'standard', // Standard account, not Express
      country: 'US', // Default from blawby method
      email: data.organizationEmail || 'onboarding@organization.com',
      businessType: 'company',
      entityType: 'organization',
      entityId: data.organizationId,
      chargesEnabled: stripeAccount.charges_enabled || false,
      payoutsEnabled: stripeAccount.payouts_enabled || false,
      detailsSubmitted: stripeAccount.details_submitted || false,
    });

    isNewAccount = true;
  }

  // Create account session for onboarding
  const accountSession = await createAccountSession(
    connectedAccount.stripeAccountId,
    {
      name: data.organizationName,
      email: data.organizationEmail,
      country: data.country,
    },
  );

  return {
    accountId: connectedAccount.stripeAccountId,
    clientSecret: accountSession.client_secret!,
  };
};

/**
 * Get onboarding status for an organization
 */
export const getOnboardingStatus = async function getOnboardingStatus(
  organizationId: string,
) {
  const stripe = getStripeClient();
  const connectedAccount = await getConnectedAccountByEntityId(organizationId);

  if (!connectedAccount) {
    return {
      hasAccount: false,
      onboardingComplete: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    };
  }

  // Get fresh data from Stripe
  const stripeAccount = await stripe.accounts.retrieve(
    connectedAccount.stripeAccountId,
  );

  return {
    hasAccount: true,
    accountId: connectedAccount.stripeAccountId,
    onboardingComplete: stripeAccount.details_submitted || false,
    chargesEnabled: stripeAccount.charges_enabled || false,
    payoutsEnabled: stripeAccount.payouts_enabled || false,
    account: connectedAccount,
  };
};
