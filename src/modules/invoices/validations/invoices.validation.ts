import { z } from 'zod';
import { nameValidator, paginatedQuerySchema } from '@/shared/validations/common';

export const createInvoiceSchema = z.object({
  name: nameValidator,
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export const invoiceQuerySchema = paginatedQuerySchema.extend({
  search: z.string().optional(),
});

export type CreateInvoiceRequest = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceRequest = z.infer<typeof updateInvoiceSchema>;
export type InvoiceQueryParams = z.infer<typeof invoiceQuerySchema>;
