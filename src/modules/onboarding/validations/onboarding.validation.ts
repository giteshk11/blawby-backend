import { z } from 'zod';
import { nameValidator, paginatedQuerySchema } from '@/shared/validations/common';

export const createOnboardingSchema = z.object({
  name: nameValidator,
});

export const updateOnboardingSchema = createOnboardingSchema.partial();

export const onboardingQuerySchema = paginatedQuerySchema.extend({
  search: z.string().optional(),
});

export type CreateOnboardingRequest = z.infer<typeof createOnboardingSchema>;
export type UpdateOnboardingRequest = z.infer<typeof updateOnboardingSchema>;
export type OnboardingQueryParams = z.infer<typeof onboardingQuerySchema>;
