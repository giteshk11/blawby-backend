import { StripeService } from './index';
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
  const stripeService = new StripeService();
  
  return await stripeService.createPaymentIntent({
    amount: data.amount,
    currency: data.currency,
    connectedAccountId: data.connectedAccountId,
    metadata: data.metadata,
  });
};

/**
 * Create a setup intent for saving payment methods
 */
export const createSetupIntent = async function createSetupIntent(
  connectedAccountId?: string,
): Promise<any> {
  const stripeService = new StripeService();
  
  return await stripeService.createSetupIntent(connectedAccountId);
};

/**
 * Process a custom payment
 */
export const processCustomPayment = async function processCustomPayment(
  data: PaymentData,
): Promise<any> {
  const stripeService = new StripeService();
  
  // Create payment intent
  const paymentIntent = await stripeService.createPaymentIntent({
    amount: data.amount,
    currency: data.currency,
    connectedAccountId: data.connectedAccountId,
    metadata: data.metadata,
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
  const stripeService = new StripeService();
  
  return await stripeService.getCharge(chargeId);
};