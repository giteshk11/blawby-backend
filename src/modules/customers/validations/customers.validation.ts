import { z } from 'zod';
import {
  nameValidator,
  paginatedQuerySchema,
} from '@/shared/validations/common';

export const createCustomerSchema = z.object({
  name: nameValidator,
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const customerQuerySchema = paginatedQuerySchema.extend({
  search: z.string().optional(),
});

export type CreateCustomerRequest = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerRequest = z.infer<typeof updateCustomerSchema>;
export type CustomerQueryParams = z.infer<typeof customerQuerySchema>;
