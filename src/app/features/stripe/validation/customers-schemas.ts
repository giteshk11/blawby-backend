import { z } from 'zod';

// Stripe Customer Schema
export const stripeCustomerSchema = z.object({
  stripeCustomerId: z.string().min(1),
  email: z.string().email(),
  name: z.string().optional(),
  phone: z.string().optional(),
  address: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  teamId: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Stripe Customer Create Schema
export const createStripeCustomerSchema = stripeCustomerSchema.omit({
  createdAt: true,
  updatedAt: true,
});

// Stripe Customer Update Schema
export const updateStripeCustomerSchema = createStripeCustomerSchema.partial();

// Stripe Customer Query Parameters Schema
export const stripeCustomerQuerySchema = z.object({
  email: z.string().email().optional(),
  teamId: z.string().optional(),
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

// Stripe Customer Path Parameters Schema
export const stripeCustomerParamsSchema = z.object({
  id: z.string().min(1),
});

// Type exports
export type StripeCustomer = z.infer<typeof stripeCustomerSchema>;
export type CreateStripeCustomer = z.infer<typeof createStripeCustomerSchema>;
export type UpdateStripeCustomer = z.infer<typeof updateStripeCustomerSchema>;
export type StripeCustomerQuery = z.infer<typeof stripeCustomerQuerySchema>;
export type StripeCustomerParams = z.infer<typeof stripeCustomerParamsSchema>;
