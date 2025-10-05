// Export Stripe client functions
export {
  getStripeClient,
  createAdvancedConnectedAccount,
  createAccountSession,
  createPaymentsAccountSession,
} from './stripe-client';

// Export all functional services
export {
  createAccount,
  getOrCreateAccount,
  refreshAccountDetails,
  createLoginLink,
  createAccountLink,
} from './connected-account-service';

export {
  createStripeCustomer,
  refreshCustomerDetails,
  updateStripeCustomer,
  deleteStripeCustomer,
} from './customer-service';

export {
  createPaymentIntent,
  createSetupIntent,
  processCustomPayment,
  handlePaymentSucceeded,
  handlePaymentFailed,
  getChargeDetails,
} from './payment-service';

export {
  createStripeSubscription,
  refreshSubscriptionDetails,
  cancelSubscription,
  createMeterEvent,
  recordInvoicePaidUsage,
  getCustomerUsageEvents,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from './subscription-service';

export {
  handleWebhookEvent,
  handleAccountUpdatedWebhook,
  handlePaymentWebhook,
  handleSubscriptionWebhook,
} from './webhook-service';

export {
  createOnboardingSession,
  getOnboardingStatus,
} from './onboarding-service';

// Re-export validation types for convenience
export type {
  StripeConnectedAccount,
  StripeCustomer,
  StripeSubscription,
  StripePayout,
  StripeUsageEvent,
  StripeCustomPayment,
} from '../types';
