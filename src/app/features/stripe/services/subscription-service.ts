import { StripeService } from './index';
import {
  createSubscription,
  getSubscriptionByStripeId,
  updateSubscription,
  deleteSubscription,
  createUsageEvent,
  getUsageEventsByCustomer,
} from 'features/stripe/database/queries';

export type SubscriptionData = {
  customerId: string;
  priceId: string;
  metadata?: Record<string, string>;
};

export type MeterEventData = {
  customerId: string;
  eventName: string;
  value: number;
  timestamp?: Date;
  metadata?: Record<string, string>;
};

/**
 * Create a subscription
 */
export const createStripeSubscription = async function createStripeSubscription(
  data: SubscriptionData,
): Promise<any> {
  const stripeService = new StripeService();
  
  // Create subscription in Stripe
  const stripeSubscription = await stripeService.createSubscription({
    customer: data.customerId,
    items: [{ price: data.priceId }],
    metadata: data.metadata,
  });

  // Save to database
  const subscription = await createSubscription({
    customerId: data.customerId,
    stripeSubscriptionId: stripeSubscription.id,
    status: stripeSubscription.status,
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    metadata: data.metadata,
  });

  return subscription;
};

/**
 * Get subscription details from Stripe and update local database
 */
export const refreshSubscriptionDetails = async function refreshSubscriptionDetails(
  subscriptionId: string,
): Promise<any> {
  const stripeService = new StripeService();
  
  // Get subscription from database
  const subscription = await getSubscriptionByStripeId(subscriptionId);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  // Get fresh data from Stripe
  const stripeSubscription = await stripeService.stripe.subscriptions.retrieve(subscriptionId);

  // Update local data
  const updatedSubscription = await updateSubscription(subscription.id, {
    status: stripeSubscription.status,
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
  });

  return updatedSubscription;
};

/**
 * Cancel a subscription
 */
export const cancelSubscription = async function cancelSubscription(
  subscriptionId: string,
): Promise<any> {
  const stripeService = new StripeService();
  
  // Cancel subscription in Stripe
  const stripeSubscription = await stripeService.stripe.subscriptions.cancel(subscriptionId);

  // Update local database
  const subscription = await getSubscriptionByStripeId(subscriptionId);
  if (subscription) {
    await updateSubscription(subscription.id, {
      status: 'canceled',
    });
  }

  return stripeSubscription;
};

/**
 * Create a metered billing event
 */
export const createMeterEvent = async function createMeterEvent(
  data: MeterEventData,
): Promise<any> {
  const stripeService = new StripeService();
  
  // Create meter event in Stripe
  const stripeEvent = await stripeService.createMeterEvent({
    customer: data.customerId,
    event_name: data.eventName,
    value: data.value,
    timestamp: data.timestamp ? Math.floor(data.timestamp.getTime() / 1000) : Math.floor(Date.now() / 1000),
    payload: data.metadata,
  });

  // Save to database
  const usageEvent = await createUsageEvent({
    customerId: data.customerId,
    eventName: data.eventName,
    value: data.value,
    timestamp: data.timestamp || new Date(),
    metadata: data.metadata,
  });

  return {
    stripeEvent,
    usageEvent,
  };
};

/**
 * Record invoice paid usage on Stripe
 */
export const recordInvoicePaidUsage = async function recordInvoicePaidUsage(
  customerId: string,
  invoiceFee: number,
): Promise<any> {
  return await createMeterEvent({
    customerId,
    eventName: 'invoice_paid',
    value: invoiceFee,
    metadata: {
      type: 'invoice_fee',
      amount: invoiceFee.toString(),
    },
  });
};

/**
 * Get usage events for a customer
 */
export const getCustomerUsageEvents = async function getCustomerUsageEvents(
  customerId: string,
): Promise<any[]> {
  return await getUsageEventsByCustomer(customerId);
};

/**
 * Handle subscription created
 */
export const handleSubscriptionCreated = async function handleSubscriptionCreated(
  subscription: any,
): Promise<void> {
  try {
    console.log('Subscription created:', subscription.id);
    
    // Create subscription in database if not exists
    const existingSubscription = await getSubscriptionByStripeId(subscription.id);
    if (!existingSubscription) {
      await createSubscription({
        customerId: subscription.customer,
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        metadata: subscription.metadata,
      });
    }
  } catch (error) {
    console.error('Error handling subscription created:', error);
    throw error;
  }
};

/**
 * Handle subscription updated
 */
export const handleSubscriptionUpdated = async function handleSubscriptionUpdated(
  subscription: any,
): Promise<void> {
  try {
    console.log('Subscription updated:', subscription.id);
    
    // Update subscription in database
    const existingSubscription = await getSubscriptionByStripeId(subscription.id);
    if (existingSubscription) {
      await updateSubscription(existingSubscription.id, {
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      });
    }
  } catch (error) {
    console.error('Error handling subscription updated:', error);
    throw error;
  }
};

/**
 * Handle subscription deleted
 */
export const handleSubscriptionDeleted = async function handleSubscriptionDeleted(
  subscription: any,
): Promise<void> {
  try {
    console.log('Subscription deleted:', subscription.id);
    
    // Delete subscription from database
    const existingSubscription = await getSubscriptionByStripeId(subscription.id);
    if (existingSubscription) {
      await deleteSubscription(existingSubscription.id);
    }
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
    throw error;
  }
};