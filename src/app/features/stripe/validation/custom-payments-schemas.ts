import { z } from 'zod';

// Stripe Custom Payment Schema
export const stripeCustomPaymentSchema = z.object({
  stripePaymentIntentId: z.string().min(1),
  stripeCustomerId: z.string().min(1),
  amount: z.number().min(0),
  currency: z.string().min(3).max(3),
  status: z.enum([
    'requires_payment_method',
    'requires_confirmation',
    'requires_action',
    'processing',
    'requires_capture',
    'canceled',
    'succeeded',
  ]),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  connectedAccountId: z.string().optional(),
  teamId: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Stripe Custom Payment Create Schema
export const createStripeCustomPaymentSchema = stripeCustomPaymentSchema.omit({
  createdAt: true,
  updatedAt: true,
});

// Stripe Custom Payment Update Schema
export const updateStripeCustomPaymentSchema =
  createStripeCustomPaymentSchema.partial();

// Stripe Custom Payment Query Parameters Schema
export const stripeCustomPaymentQuerySchema = z.object({
  status: z
    .enum([
      'requires_payment_method',
      'requires_confirmation',
      'requires_action',
      'processing',
      'requires_capture',
      'canceled',
      'succeeded',
    ])
    .optional(),
  stripeCustomerId: z.string().optional(),
  connectedAccountId: z.string().optional(),
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

// Stripe Custom Payment Path Parameters Schema
export const stripeCustomPaymentParamsSchema = z.object({
  id: z.string().min(1),
});

// Type exports
export type StripeCustomPayment = z.infer<typeof stripeCustomPaymentSchema>;
export type CreateStripeCustomPayment = z.infer<
  typeof createStripeCustomPaymentSchema
>;
export type UpdateStripeCustomPayment = z.infer<
  typeof updateStripeCustomPaymentSchema
>;
export type StripeCustomPaymentQuery = z.infer<
  typeof stripeCustomPaymentQuerySchema
>;
export type StripeCustomPaymentParams = z.infer<
  typeof stripeCustomPaymentParamsSchema
>;


