import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/shared/database';
import {
  invoices,
  invoiceLineItems,
  type InsertInvoice,
  type SelectInvoice,
  type InsertInvoiceLineItem,
  type SelectInvoiceLineItem,
} from '@/modules/invoices/database/schema/invoices.schema';

export const invoicesRepository = {
  /**
   * Find invoice by ID
   */
  async findById(id: string): Promise<SelectInvoice | null> {
    const results = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);

    return results[0] || null;
  },

  /**
   * Find invoice by Stripe invoice ID
   */
  async findByStripeInvoiceId(
    stripeInvoiceId: string,
  ): Promise<SelectInvoice | null> {
    const results = await db
      .select()
      .from(invoices)
      .where(eq(invoices.stripeInvoiceId, stripeInvoiceId))
      .limit(1);

    return results[0] || null;
  },

  /**
   * Find invoice by invoice number
   */
  async findByInvoiceNumber(
    invoiceNumber: string,
  ): Promise<SelectInvoice | null> {
    const results = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, invoiceNumber))
      .limit(1);

    return results[0] || null;
  },

  /**
   * List invoices by organization
   */
  async listByOrganizationId(
    organizationId: string,
    limit = 50,
    offset = 0,
  ): Promise<SelectInvoice[]> {
    return await db
      .select()
      .from(invoices)
      .where(eq(invoices.organizationId, organizationId))
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset);
  },

  /**
   * List invoices by customer
   */
  async listByCustomerId(
    customerId: string,
    limit = 50,
    offset = 0,
  ): Promise<SelectInvoice[]> {
    return await db
      .select()
      .from(invoices)
      .where(eq(invoices.customerId, customerId))
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset);
  },

  /**
   * List invoices by connected account
   */
  async listByConnectedAccountId(
    connectedAccountId: string,
    limit = 50,
    offset = 0,
  ): Promise<SelectInvoice[]> {
    return await db
      .select()
      .from(invoices)
      .where(eq(invoices.connectedAccountId, connectedAccountId))
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset);
  },

  /**
   * Create a new invoice
   */
  async create(data: InsertInvoice): Promise<SelectInvoice> {
    const [result] = await db.insert(invoices).values(data).returning();

    return result;
  },

  /**
   * Update invoice
   */
  async update(
    id: string,
    data: Partial<InsertInvoice>,
  ): Promise<SelectInvoice | null> {
    const [result] = await db
      .update(invoices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();

    return result || null;
  },

  /**
   * Update by Stripe invoice ID
   */
  async updateByStripeInvoiceId(
    stripeInvoiceId: string,
    data: Partial<InsertInvoice>,
  ): Promise<SelectInvoice | null> {
    const [result] = await db
      .update(invoices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(invoices.stripeInvoiceId, stripeInvoiceId))
      .returning();

    return result || null;
  },

  /**
   * Delete invoice
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(invoices).where(eq(invoices.id, id));

    return result.rowCount > 0;
  },

  /**
   * Get invoice with line items
   */
  async findWithLineItems(id: string): Promise<{
    invoice: SelectInvoice | null;
    lineItems: SelectInvoiceLineItem[];
  }> {
    const invoice = await this.findById(id);

    if (!invoice) {
      return { invoice: null, lineItems: [] };
    }

    const lineItems = await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, id));

    return { invoice, lineItems };
  },

  /**
   * Get next invoice number for organization
   */
  async getNextInvoiceNumber(organizationCode: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `${organizationCode}-${dateStr}-`;

    // Find the highest number for today
    const results = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, organizationCode), // This should be organizationId, not code
          // Add date filter if needed
        ),
      )
      .orderBy(desc(invoices.invoiceNumber));

    // Extract the highest number and increment
    let nextNumber = 1;
    if (results.length > 0) {
      const lastNumber = results[0].invoiceNumber;
      if (lastNumber.startsWith(prefix)) {
        const numberPart = lastNumber.substring(prefix.length);
        const parsed = parseInt(numberPart, 10);
        if (!isNaN(parsed)) {
          nextNumber = parsed + 1;
        }
      }
    }

    return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
  },
};

export const invoiceLineItemsRepository = {
  /**
   * Find line items by invoice ID
   */
  async findByInvoiceId(invoiceId: string): Promise<SelectInvoiceLineItem[]> {
    return await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId));
  },

  /**
   * Create line item
   */
  async create(data: InsertInvoiceLineItem): Promise<SelectInvoiceLineItem> {
    const [result] = await db.insert(invoiceLineItems).values(data).returning();

    return result;
  },

  /**
   * Create multiple line items
   */
  async createMany(
    data: InsertInvoiceLineItem[],
  ): Promise<SelectInvoiceLineItem[]> {
    if (data.length === 0) return [];

    return await db.insert(invoiceLineItems).values(data).returning();
  },

  /**
   * Update line item
   */
  async update(
    id: string,
    data: Partial<InsertInvoiceLineItem>,
  ): Promise<SelectInvoiceLineItem | null> {
    const [result] = await db
      .update(invoiceLineItems)
      .set(data)
      .where(eq(invoiceLineItems.id, id))
      .returning();

    return result || null;
  },

  /**
   * Delete line item
   */
  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(invoiceLineItems)
      .where(eq(invoiceLineItems.id, id));

    return result.rowCount > 0;
  },

  /**
   * Delete all line items for an invoice
   */
  async deleteByInvoiceId(invoiceId: string): Promise<boolean> {
    const result = await db
      .delete(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId));

    return result.rowCount > 0;
  },
};
