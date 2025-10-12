/**
 * Invoices Service
 *
 * Handles invoice creation, management, and processing
 * Implements Laravel's invoice functionality with improvements
 */

import type { FastifyInstance } from 'fastify';
import { stripeConnectedAccountsRepository } from '@/modules/onboarding/database/queries/connected-accounts.repository';
import { clientsRepository } from '@/modules/clients/database/queries/clients.repository';
import {
  invoicesRepository,
  invoiceLineItemsRepository,
} from '@/modules/invoices/database/queries/invoices.repository';
// Transfers functionality removed - billing module deleted
import type {
  InsertInvoice,
  InsertInvoiceLineItem,
} from '@/modules/invoices/database/schema/invoices.schema';

export interface CreateInvoiceRequest {
  organizationId: string;
  customerId: string;
  invoiceType: 'customer' | 'platform';
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number; // in cents
  }>;
  dueDate?: Date;
  metadata?: Record<string, unknown>;
}

export interface CreateInvoiceResponse {
  success: boolean;
  invoice?: {
    id: string;
    invoiceNumber: string;
    stripeInvoiceId: string;
    amountDue: number;
    status: string;
  };
  error?: string;
}

export interface SendInvoiceRequest {
  invoiceId: string;
  organizationId: string;
}

export interface SendInvoiceResponse {
  success: boolean;
  invoiceUrl?: string;
  error?: string;
}

/**
 * Create invoice service
 */
export const createInvoiceService = function createInvoiceService(
  fastify: FastifyInstance,
): {
  createInvoice(request: CreateInvoiceRequest): Promise<CreateInvoiceResponse>;
  sendInvoice(request: SendInvoiceRequest): Promise<SendInvoiceResponse>;
  getInvoice(invoiceId: string, organizationId: string): Promise<unknown>;
  listInvoices(organizationId: string, limit?: number): Promise<unknown>;
  updateInvoiceStatus(invoiceId: string, status: string): Promise<unknown>;
} {
  return {
    /**
     * Create a new invoice
     */
    async createInvoice(
      request: CreateInvoiceRequest,
    ): Promise<CreateInvoiceResponse> {
      try {
        // 1. Validate organization has connected account
        const connectedAccount =
          await stripeConnectedAccountsRepository.findByOrganizationId(
            request.organizationId,
          );

        if (!connectedAccount) {
          return {
            success: false,
            error: 'Organization does not have a connected Stripe account',
          };
        }

        // 2. Validate client exists
        const client = await clientsRepository.findById(request.customerId);
        if (!client) {
          return {
            success: false,
            error: 'Client not found',
          };
        }

        // 3. Calculate total amount
        const lineItems = request.lineItems.map((item) => ({
          ...item,
          lineTotal: item.quantity * item.unitPrice,
        }));

        const totalAmount = lineItems.reduce(
          (sum, item) => sum + item.lineTotal,
          0,
        );

        // 4. Generate invoice number
        const invoiceNumber = await invoicesRepository.getNextInvoiceNumber(
          request.organizationId, // This should be organization code, not ID
        );

        // 5. Create invoice on Stripe
        const stripeInvoice = await fastify.stripe.invoices.create({
          customer: client.stripeCustomerId,
          collection_method: 'send_invoice',
          days_until_due: request.dueDate
            ? Math.ceil(
                (request.dueDate.getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24),
              )
            : 30,
          metadata: {
            organizationId: request.organizationId,
            invoiceType: request.invoiceType,
            ...request.metadata,
          },
        });

        // 6. Add line items to Stripe invoice
        for (const item of lineItems) {
          await fastify.stripe.invoiceItems.create({
            customer: client.stripeCustomerId,
            invoice: stripeInvoice.id,
            description: item.description,
            quantity: item.quantity,
            unit_amount: item.unitPrice,
          });
        }

        // 7. Finalize the invoice
        const finalizedInvoice = await fastify.stripe.invoices.finalizeInvoice(
          stripeInvoice.id,
        );

        // 8. Store invoice in database
        const invoiceData: InsertInvoice = {
          organizationId: request.organizationId,
          customerId: request.customerId,
          connectedAccountId: connectedAccount.id,
          stripeInvoiceId: finalizedInvoice.id,
          stripePaymentIntentId: finalizedInvoice.payment_intent as string,
          invoiceNumber,
          invoiceType: request.invoiceType,
          amountDue: totalAmount,
          amountPaid: 0,
          amountRemaining: totalAmount,
          currency: 'usd',
          status: 'open',
          dueDate: request.dueDate,
        };

        const invoice = await invoicesRepository.create(invoiceData);

        // 9. Store line items
        const lineItemData: InsertInvoiceLineItem[] = lineItems.map((item) => ({
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        }));

        await invoiceLineItemsRepository.createMany(lineItemData);

        // 10. Publish event
        await fastify.events.publish({
          eventType: 'BILLING_INVOICE_CREATED',
          eventVersion: '1.0.0',
          actorId: request.organizationId,
          actorType: 'organization',
          organizationId: request.organizationId,
          payload: {
            invoiceId: invoice.id,
            invoiceNumber,
            amount: totalAmount,
            customerId: request.customerId,
          },
          metadata: fastify.events.createMetadata('api'),
        });

        return {
          success: true,
          invoice: {
            id: invoice.id,
            invoiceNumber,
            stripeInvoiceId: finalizedInvoice.id,
            amountDue: totalAmount,
            status: invoice.status,
          },
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to create invoice');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    /**
     * Send invoice to customer
     */
    async sendInvoice(
      request: SendInvoiceRequest,
    ): Promise<SendInvoiceResponse> {
      try {
        // 1. Get invoice
        const invoice = await invoicesRepository.findById(request.invoiceId);
        if (!invoice) {
          return {
            success: false,
            error: 'Invoice not found',
          };
        }

        // 2. Verify organization owns this invoice
        if (invoice.organizationId !== request.organizationId) {
          return {
            success: false,
            error: 'Unauthorized access to invoice',
          };
        }

        // 3. Send invoice via Stripe
        const stripeInvoice = await fastify.stripe.invoices.sendInvoice(
          invoice.stripeInvoiceId,
        );

        // 4. Update invoice status
        await invoicesRepository.update(invoice.id, {
          status: 'open',
        });

        // 5. Publish event
        await fastify.events.publish({
          eventType: 'BILLING_INVOICE_SENT',
          eventVersion: '1.0.0',
          actorId: request.organizationId,
          actorType: 'organization',
          organizationId: request.organizationId,
          payload: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            customerId: invoice.customerId,
          },
          metadata: fastify.events.createMetadata('api'),
        });

        return {
          success: true,
          invoiceUrl: stripeInvoice.hosted_invoice_url || undefined,
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to send invoice');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    /**
     * Void an invoice
     */
    async voidInvoice(
      invoiceId: string,
      organizationId: string,
    ): Promise<{ success: boolean; error?: string }> {
      try {
        // 1. Get invoice
        const invoice = await invoicesRepository.findById(invoiceId);
        if (!invoice) {
          return {
            success: false,
            error: 'Invoice not found',
          };
        }

        // 2. Verify organization owns this invoice
        if (invoice.organizationId !== organizationId) {
          return {
            success: false,
            error: 'Unauthorized access to invoice',
          };
        }

        // 3. Void invoice on Stripe
        await fastify.stripe.invoices.voidInvoice(invoice.stripeInvoiceId);

        // 4. Update invoice status
        await invoicesRepository.update(invoice.id, {
          status: 'void',
          voidedAt: new Date(),
        });

        // 5. Publish event
        await fastify.events.publish({
          eventType: 'BILLING_INVOICE_VOIDED',
          eventVersion: '1.0.0',
          actorId: organizationId,
          actorType: 'organization',
          organizationId,
          payload: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
          },
          metadata: fastify.events.createMetadata('api'),
        });

        return { success: true };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to void invoice');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    /**
     * Get invoice with line items
     */
    async getInvoice(
      invoiceId: string,
      organizationId: string,
    ): Promise<{
      success: boolean;
      invoice?: unknown;
      error?: string;
    }> {
      try {
        const { invoice, lineItems } =
          await invoicesRepository.findWithLineItems(invoiceId);

        if (!invoice) {
          return {
            success: false,
            error: 'Invoice not found',
          };
        }

        // Verify organization owns this invoice
        if (invoice.organizationId !== organizationId) {
          return {
            success: false,
            error: 'Unauthorized access to invoice',
          };
        }

        return {
          success: true,
          invoice: {
            ...invoice,
            lineItems,
          },
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get invoice');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    /**
     * List invoices for organization
     */
    async listInvoices(
      organizationId: string,
      limit = 50,
      offset = 0,
    ): Promise<{
      success: boolean;
      invoices?: unknown[];
      error?: string;
    }> {
      try {
        const invoices = await invoicesRepository.listByOrganizationId(
          organizationId,
          limit,
          offset,
        );

        return {
          success: true,
          invoices,
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to list invoices');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  };
};
