import { z } from 'zod';
import {
  nameValidator,
  paginatedQuerySchema,
} from '@/shared/validations/common';

export const createStripeSchema = z.object({
  name: nameValidator,
});

export const updateStripeSchema = createStripeSchema.partial();

export const stripeQuerySchema = paginatedQuerySchema.extend({
  search: z.string().optional(),
});

export type CreateStripeRequest = z.infer<typeof createStripeSchema>;
export type UpdateStripeRequest = z.infer<typeof updateStripeSchema>;
export type StripeQueryParams = z.infer<typeof stripeQuerySchema>;
