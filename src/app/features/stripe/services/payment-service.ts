import { getStripeClient } from './stripe-client';
import {
  createCustomPayment,
  getCustomPaymentByStripeId,
  updateCustomPayment,
} from 'features/stripe/database/queries';

export type PaymentData = {
  amount: number;
  currency: string;
  connectedAccountId?: string;
  customerId?: string;
  metadata?: Record<string, string>;
};

export type PaymentIntentData = {
  amount: number;
  currency: string;
  connectedAccountId?: string;
  metadata?: Record<string, string>;
};

/**
 * Create a payment intent
 */
export const createPaymentIntent = async function createPaymentIntent(
  data: PaymentIntentData,
): Promise<any> {
  const stripe = getStripeClient();

  const paymentIntentData: any = {
    amount: data.amount,
    currency: data.currency,
    metadata: data.metadata,
  };

  if (data.connectedAccountId) {
    paymentIntentData.application_fee_amount = Math.round(data.amount * 0.1); // 10% fee
  }

  return await stripe.paymentIntents.create(paymentIntentData, {
    stripeAccount: data.connectedAccountId,
  });
};

/**
 * Create a setup intent for saving payment methods
 */
export const createSetupIntent = async function createSetupIntent(
  connectedAccountId?: string,
): Promise<any> {
  const stripe = getStripeClient();

  return await stripe.setupIntents.create(
    {},
    {
      stripeAccount: connectedAccountId,
    },
  );
};

/**
 * Process a custom payment
 */
export const processCustomPayment = async function processCustomPayment(
  data: PaymentData,
): Promise<any> {
  const stripe = getStripeClient();

  // Create payment intent
  const paymentIntentData: any = {
    amount: data.amount,
    currency: data.currency,
    metadata: data.metadata,
  };

  if (data.connectedAccountId) {
    paymentIntentData.application_fee_amount = Math.round(data.amount * 0.1); // 10% fee
  }

  const paymentIntent = await stripe.paymentIntents.create(paymentIntentData, {
    stripeAccount: data.connectedAccountId,
  });

  // Save to database
  const customPayment = await createCustomPayment({
    amount: data.amount,
    currency: data.currency,
    stripePaymentIntentId: paymentIntent.id,
    connectedAccountId: data.connectedAccountId,
    customerId: data.customerId,
    status: paymentIntent.status,
    metadata: data.metadata,
  });

  return {
    paymentIntent,
    customPayment,
  };
};

/**
 * Handle successful payment
 */
export const handlePaymentSucceeded = async function handlePaymentSucceeded(
  paymentIntentId: string,
): Promise<void> {
  // Get payment from database
  const payment = await getCustomPaymentByStripeId(paymentIntentId);

  if (payment) {
    // Update payment status
    await updateCustomPayment(payment.id, {
      status: 'succeeded',
    });
  }
};

/**
 * Handle failed payment
 */
export const handlePaymentFailed = async function handlePaymentFailed(
  paymentIntentId: string,
): Promise<void> {
  // Get payment from database
  const payment = await getCustomPaymentByStripeId(paymentIntentId);

  if (payment) {
    // Update payment status
    await updateCustomPayment(payment.id, {
      status: 'failed',
    });
  }
};

/**
 * Get charge details
 */
export const getChargeDetails = async function getChargeDetails(
  chargeId: string,
): Promise<any> {
  const stripe = getStripeClient();

  return await stripe.charges.retrieve(chargeId);
};
