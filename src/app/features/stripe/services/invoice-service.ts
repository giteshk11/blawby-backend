import { getStripeClient } from './stripe-client';
import { StripeUsageEventQueries } from 'features/stripe/database/queries';

export type InvoiceData = {
  customerId: string;
  amount?: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, string>;
};

export type InvoiceItemData = {
  customerId: string;
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
};

/**
 * Create an invoice
 */
export const createInvoice = async function createInvoice(
  data: InvoiceData,
): Promise<any> {
  const stripe = getStripeClient();

  return await stripe.invoices.create({
    customer: data.customerId,
    currency: data.currency || 'USD',
    description: data.description,
    metadata: data.metadata,
  });
};

/**
 * Create an invoice item
 */
export const createInvoiceItem = async function createInvoiceItem(
  data: InvoiceItemData,
): Promise<any> {
  const stripe = getStripeClient();

  return await stripeService.createInvoiceItem({
    customer: data.customerId,
    amount: data.amount,
    currency: data.currency,
    description: data.description,
    metadata: data.metadata,
  });
};

/**
 * Finalize an invoice
 */
export const finalizeInvoice = async function finalizeInvoice(
  invoiceId: string,
): Promise<any> {
  const stripeService = new StripeService();

  return await stripeService.finalizeInvoice(invoiceId);
};

/**
 * Send an invoice to customer
 */
export const sendInvoice = async function sendInvoice(
  invoiceId: string,
): Promise<any> {
  const stripeService = new StripeService();

  return await stripeService.sendInvoice(invoiceId);
};

/**
 * Pay an invoice
 */
export const payInvoice = async function payInvoice(
  invoiceId: string,
): Promise<any> {
  const stripeService = new StripeService();

  return await stripeService.payInvoice(invoiceId);
};

/**
 * Void an invoice
 */
export const voidInvoice = async function voidInvoice(
  invoiceId: string,
): Promise<any> {
  const stripeService = new StripeService();

  return await stripeService.voidInvoice(invoiceId);
};

/**
 * List invoices
 */
export const listInvoices = async function listInvoices(
  params: any,
): Promise<any> {
  const stripeService = new StripeService();

  return await stripeService.listInvoices(params);
};

/**
 * Handle invoice paid by customer
 */
export const handleInvoicePaid = async function handleInvoicePaid(
  invoice: any,
): Promise<void> {
  try {
    console.log('Invoice paid by customer:', invoice.id);

    // Record usage event for invoice fee
    if (invoice.customer) {
      const invoiceFee = invoice.total || 0;
      await StripeUsageEventQueries.createUsageEvent({
        stripeCustomerId: invoice.customer as string,
        eventName: 'invoice_paid',
        object: 'invoice',
        payload: JSON.stringify({
          invoiceId: invoice.id,
          amount: invoiceFee,
        }),
        connectedAccountId: 'default', // This needs to be properly determined
      });
    }
  } catch (error) {
    console.error('Error handling invoice paid:', error);
    throw error;
  }
};

/**
 * Handle invoice payment failed
 */
export const handleInvoicePaymentFailed =
  async function handleInvoicePaymentFailed(invoice: any): Promise<void> {
    try {
      console.log('Invoice payment failed:', invoice.id);

      // Record failed payment event
      if (invoice.customer) {
        await StripeUsageEventQueries.createUsageEvent({
          stripeCustomerId: invoice.customer as string,
          eventName: 'invoice_payment_failed',
          object: 'invoice',
          payload: JSON.stringify({
            invoiceId: invoice.id,
            failureReason: invoice.last_payment_error?.message || 'Unknown',
          }),
          connectedAccountId: 'default', // This needs to be properly determined
        });
      }
    } catch (error) {
      console.error('Error handling invoice payment failed:', error);
      throw error;
    }
  };
