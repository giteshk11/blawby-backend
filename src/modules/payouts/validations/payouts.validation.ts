import { z } from 'zod';
import {
  nameValidator,
  paginatedQuerySchema,
} from '@/shared/validations/common';

export const createPayoutSchema = z.object({
  name: nameValidator,
});

export const updatePayoutSchema = createPayoutSchema.partial();

export const payoutQuerySchema = paginatedQuerySchema.extend({
  search: z.string().optional(),
});

export type CreatePayoutRequest = z.infer<typeof createPayoutSchema>;
export type UpdatePayoutRequest = z.infer<typeof updatePayoutSchema>;
export type PayoutQueryParams = z.infer<typeof payoutQuerySchema>;
