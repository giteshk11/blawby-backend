import { StripeService } from './index';
import {
  handleAccountUpdated,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handlePaymentSucceeded,
  handlePaymentFailed,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from './index';

export type WebhookEvent = {
  id: string;
  type: string;
  data: {
    object: any;
  };
};

/**
 * Handle Stripe webhook events
 */
export const handleWebhookEvent = async function handleWebhookEvent(
  payload: string,
  signature: string,
  webhookSecret: string,
): Promise<void> {
  const stripeService = new StripeService();
  
  try {
    // Verify webhook signature
    const event = await stripeService.handleWebhook(payload, signature, webhookSecret);
    
    console.log('Processing webhook event:', event.type);
    
    // Route event to appropriate handler
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handleInvoicePaid(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
        
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object.id);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object.id);
        break;
        
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
        
      default:
        console.log('Unhandled webhook event type:', event.type);
    }
  } catch (error) {
    console.error('Error processing webhook event:', error);
    throw error;
  }
};

/**
 * Handle account updated webhook
 */
export const handleAccountUpdatedWebhook = async function handleAccountUpdatedWebhook(
  accountData: any,
): Promise<void> {
  try {
    console.log('Account updated:', accountData.id);
    
    // Update account in database
    await handleAccountUpdated(accountData);
  } catch (error) {
    console.error('Error handling account updated webhook:', error);
    throw error;
  }
};

/**
 * Handle invoice webhook events
 */
export const handleInvoiceWebhook = async function handleInvoiceWebhook(
  eventType: string,
  invoice: any,
): Promise<void> {
  try {
    console.log(`Invoice ${eventType}:`, invoice.id);
    
    switch (eventType) {
      case 'invoice.payment_succeeded':
        await handleInvoicePaid(invoice);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(invoice);
        break;
      default:
        console.log('Unhandled invoice event type:', eventType);
    }
  } catch (error) {
    console.error('Error handling invoice webhook:', error);
    throw error;
  }
};

/**
 * Handle payment webhook events
 */
export const handlePaymentWebhook = async function handlePaymentWebhook(
  eventType: string,
  paymentIntent: any,
): Promise<void> {
  try {
    console.log(`Payment ${eventType}:`, paymentIntent.id);
    
    switch (eventType) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(paymentIntent.id);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(paymentIntent.id);
        break;
      default:
        console.log('Unhandled payment event type:', eventType);
    }
  } catch (error) {
    console.error('Error handling payment webhook:', error);
    throw error;
  }
};

/**
 * Handle subscription webhook events
 */
export const handleSubscriptionWebhook = async function handleSubscriptionWebhook(
  eventType: string,
  subscription: any,
): Promise<void> {
  try {
    console.log(`Subscription ${eventType}:`, subscription.id);
    
    switch (eventType) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(subscription);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(subscription);
        break;
      default:
        console.log('Unhandled subscription event type:', eventType);
    }
  } catch (error) {
    console.error('Error handling subscription webhook:', error);
    throw error;
  }
};
