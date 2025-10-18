import { z } from 'zod';
import {
  nameValidator,
  paginatedQuerySchema,
} from '@/shared/validations/common';

export const createSubscriptionSchema = z.object({
  name: nameValidator,
});

export const updateSubscriptionSchema = createSubscriptionSchema.partial();

export const subscriptionQuerySchema = paginatedQuerySchema.extend({
  search: z.string().optional(),
});

export type CreateSubscriptionRequest = z.infer<
  typeof createSubscriptionSchema
>;
export type UpdateSubscriptionRequest = z.infer<
  typeof updateSubscriptionSchema
>;
export type SubscriptionQueryParams = z.infer<typeof subscriptionQuerySchema>;
