import { z } from 'zod';
import {
  nameValidator,
  emailValidator,
  phoneValidator,
  paginatedQuerySchema,
} from '@/shared/validations/common';

// Client validation schemas
export const clientNameSchema = nameValidator;
export const clientEmailSchema = emailValidator.optional();
export const clientPhoneSchema = phoneValidator.optional();

export const createClientSchema = z.object({
  name: clientNameSchema,
  email: clientEmailSchema,
  phone: clientPhoneSchema,
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export const clientQuerySchema = paginatedQuerySchema.extend({
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
});

// Infer types from schemas
export type CreateClientRequest = z.infer<typeof createClientSchema>;
export type UpdateClientRequest = z.infer<typeof updateClientSchema>;
export type ClientQueryParams = z.infer<typeof clientQuerySchema>;
