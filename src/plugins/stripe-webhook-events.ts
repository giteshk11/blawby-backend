import { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import Stripe from 'stripe';
import { EventEmitter } from 'events';
import { serviceRegistry } from './stripe-service-registry';

/**
 * Base webhook event interface
 */
export interface WebhookEvent {
  type: string;
  eventId: string;
  timestamp: Date;
  data: any;
  accountId?: string;
}

/**
 * Payment-related webhook events
 */
export interface PaymentWebhookEvent extends WebhookEvent {
  type:
    | 'payment.succeeded'
    | 'payment.failed'
    | 'payout.paid'
    | 'charge.succeeded';
  data: Stripe.Charge | Stripe.PaymentIntent | Stripe.Payout;
}

/**
 * Invoice-related webhook events
 */
export interface InvoiceWebhookEvent extends WebhookEvent {
  type:
    | 'invoice.paid'
    | 'invoice.payment_failed'
    | 'invoice.created'
    | 'invoice.updated'
    | 'invoice.finalized'
    | 'invoice.sent'
    | 'invoice.voided';
  data: Stripe.Invoice;
}

/**
 * Connected account webhook events
 */
export interface ConnectedAccountWebhookEvent extends WebhookEvent {
  type: 'account.updated' | 'account.deauthorized' | 'capability.updated';
  data: Stripe.Account | Stripe.Capability;
}

/**
 * Subscription webhook events
 */
export interface SubscriptionWebhookEvent extends WebhookEvent {
  type:
    | 'subscription.created'
    | 'subscription.updated'
    | 'subscription.deleted'
    | 'price.created'
    | 'price.updated'
    | 'price.deleted';
  data: Stripe.Subscription | Stripe.Price;
}

/**
 * Union type for all webhook events
 */
export type StripeWebhookEvent =
  | PaymentWebhookEvent
  | InvoiceWebhookEvent
  | ConnectedAccountWebhookEvent
  | SubscriptionWebhookEvent;

/**
 * Create a webhook event from Stripe event
 */
export const createWebhookEvent = (
  stripeEvent: Stripe.Event,
): StripeWebhookEvent => {
  const baseEvent = {
    eventId: stripeEvent.id,
    timestamp: new Date(stripeEvent.created * 1000),
    accountId: stripeEvent.account,
  };

  switch (stripeEvent.type) {
    case 'charge.succeeded':
    case 'payment_intent.succeeded':
    case 'payment_intent.payment_failed':
    case 'payout.paid':
      return {
        ...baseEvent,
        type: stripeEvent.type,
        data: stripeEvent.data.object,
      } as PaymentWebhookEvent;

    case 'invoice.paid':
    case 'invoice.payment_failed':
    case 'invoice.created':
    case 'invoice.updated':
    case 'invoice.finalized':
    case 'invoice.sent':
    case 'invoice.voided':
      return {
        ...baseEvent,
        type: stripeEvent.type,
        data: stripeEvent.data.object,
      } as InvoiceWebhookEvent;

    case 'account.updated':
    case 'account.application.deauthorized':
    case 'capability.updated':
      return {
        ...baseEvent,
        type: stripeEvent.type,
        data: stripeEvent.data.object,
      } as ConnectedAccountWebhookEvent;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'price.created':
    case 'price.updated':
    case 'price.deleted':
      return {
        ...baseEvent,
        type: stripeEvent.type,
        data: stripeEvent.data.object,
      } as SubscriptionWebhookEvent;

    default:
      throw new Error(`Unsupported webhook event type: ${stripeEvent.type}`);
  }
};

/**
 * Stripe Webhook Events Plugin
 * Provides event-driven webhook processing for Stripe events
 */
export default fastifyPlugin(async (fastify: FastifyInstance) => {
  // Create webhook event emitter
  const webhookEventEmitter = new EventEmitter();

  // Initialize service registry
  serviceRegistry.initialize();

  // Initialize webhook event listeners
  const initializeWebhookListeners = (): void => {
    console.log('🎯 [StripeWebhookEvents] Initializing event listeners...');

    // Payment events
    webhookEventEmitter.on(
      'charge.succeeded',
      async (event: PaymentWebhookEvent) => {
        const paymentService = (await serviceRegistry.getService(
          'payment-service',
        )) as any;
        const charge = event.data as any;
        if (!charge.invoice) {
          await paymentService.updateTeamCustomPayment(charge, false);
        }
      },
    );

    webhookEventEmitter.on(
      'payout.paid',
      async (event: PaymentWebhookEvent) => {
        const paymentService = (await serviceRegistry.getService(
          'payment-service',
        )) as any;
        const payout = event.data as any;
        await paymentService.handlePayoutPaidToConnectedAccount(
          payout,
          event.accountId || '',
        );
      },
    );

    // Invoice events
    webhookEventEmitter.on(
      'invoice.paid',
      async (event: InvoiceWebhookEvent) => {
        const invoiceService = (await serviceRegistry.getService(
          'invoice-service',
        )) as any;
        const invoice = event.data as any;
        if (invoice.metadata?.type === 'customer') {
          await invoiceService.handleInvoicePaidByCustomer(invoice);
        } else {
          await invoiceService.handleInvoicePaidByTeam(invoice);
        }
      },
    );

    webhookEventEmitter.on(
      'invoice.payment_failed',
      async (event: InvoiceWebhookEvent) => {
        const invoiceService = (await serviceRegistry.getService(
          'invoice-service',
        )) as any;
        await invoiceService.handleInvoicePaymentFailed(event as any);
      },
    );

    // Connected account events
    webhookEventEmitter.on(
      'account.updated',
      async (event: ConnectedAccountWebhookEvent) => {
        const connectedAccountService = (await serviceRegistry.getService(
          'connected-account-service',
        )) as any;
        const account = event.data as any;
        await connectedAccountService.handleAccountUpdated(account);
      },
    );

    // Subscription events
    webhookEventEmitter.on(
      'price.created',
      async (event: SubscriptionWebhookEvent) => {
        const subscriptionService = (await serviceRegistry.getService(
          'subscription-service',
        )) as any;
        await subscriptionService.handlePriceUpdates(event as any, event.type);
      },
    );

    webhookEventEmitter.on(
      'price.updated',
      async (event: SubscriptionWebhookEvent) => {
        const subscriptionService = (await serviceRegistry.getService(
          'subscription-service',
        )) as any;
        await subscriptionService.handlePriceUpdates(event as any, event.type);
      },
    );

    webhookEventEmitter.on(
      'price.deleted',
      async (event: SubscriptionWebhookEvent) => {
        const subscriptionService = (await serviceRegistry.getService(
          'subscription-service',
        )) as any;
        await subscriptionService.handlePriceUpdates(event as any, event.type);
      },
    );

    console.log('✅ [StripeWebhookEvents] Event listeners initialized');
  };

  // Process webhook event by emitting it to listeners
  const processWebhookEvent = async (
    stripeEvent: Stripe.Event,
  ): Promise<void> => {
    try {
      const webhookEvent = createWebhookEvent(stripeEvent);
      webhookEventEmitter.emit(webhookEvent.type, webhookEvent);
    } catch (error) {
      console.error(
        `❌ [StripeWebhookEvents] Error processing event ${stripeEvent.type}:`,
        error,
      );
    }
  };

  // Initialize listeners
  initializeWebhookListeners();

  // Decorate Fastify instance with webhook event methods
  fastify.decorate('stripeWebhookEvents', {
    emitter: webhookEventEmitter,
    processEvent: processWebhookEvent,
    createEvent: createWebhookEvent,
  });
});

// Add types for TypeScript
declare module 'fastify' {
  interface FastifyInstance {
    stripeWebhookEvents: {
      emitter: EventEmitter;
      processEvent: (stripeEvent: Stripe.Event) => Promise<void>;
      createEvent: (stripeEvent: Stripe.Event) => StripeWebhookEvent;
    };
  }
}
