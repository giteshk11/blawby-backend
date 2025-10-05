import { z } from 'zod';

// Stripe Connected Account Schema
export const stripeConnectedAccountSchema = z.object({
  stripeAccountId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  status: z.string().optional(),
  chargesEnabled: z.boolean().optional(),
  payoutsEnabled: z.boolean().optional(),
  detailsSubmitted: z.boolean().optional(),
  email: z.string().email().optional(),
  country: z.string().optional(),
  defaultCurrency: z.string().optional(),
  businessType: z.enum(['individual', 'company']).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Stripe Connected Account Create Schema
export const createStripeConnectedAccountSchema =
  stripeConnectedAccountSchema.omit({
    createdAt: true,
    updatedAt: true,
  });

// Stripe Connected Account Update Schema
export const updateStripeConnectedAccountSchema =
  createStripeConnectedAccountSchema.partial();

// Stripe Connected Account Query Parameters Schema
export const stripeConnectedAccountQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  status: z.string().optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(100))
    .optional(),
  offset: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(0))
    .optional(),
});

// Stripe Connected Account Path Parameters Schema
export const stripeConnectedAccountParamsSchema = z.object({
  id: z.string().min(1),
});

// Type exports
export type StripeConnectedAccount = z.infer<
  typeof stripeConnectedAccountSchema
>;
export type CreateStripeConnectedAccount = z.infer<
  typeof createStripeConnectedAccountSchema
>;
export type UpdateStripeConnectedAccount = z.infer<
  typeof updateStripeConnectedAccountSchema
>;
export type StripeConnectedAccountQuery = z.infer<
  typeof stripeConnectedAccountQuerySchema
>;
export type StripeConnectedAccountParams = z.infer<
  typeof stripeConnectedAccountParamsSchema
>;
