import { z } from 'zod';

// Stripe Subscription Schema
export const stripeSubscriptionSchema = z.object({
  stripeSubscriptionId: z.string().min(1),
  stripeCustomerId: z.string().min(1),
  status: z.enum([
    'active',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'past_due',
    'trialing',
    'unpaid',
  ]),
  currentPeriodStart: z.date(),
  currentPeriodEnd: z.date(),
  cancelAtPeriodEnd: z.boolean().optional(),
  canceledAt: z.date().optional(),
  trialStart: z.date().optional(),
  trialEnd: z.date().optional(),
  planId: z.string().optional(),
  planName: z.string().optional(),
  planAmount: z.number().min(0).optional(),
  planCurrency: z.string().optional(),
  planInterval: z.enum(['day', 'week', 'month', 'year']).optional(),
  connectedAccountId: z.string().optional(),
  teamId: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Stripe Subscription Create Schema
export const createStripeSubscriptionSchema = stripeSubscriptionSchema.omit({
  createdAt: true,
  updatedAt: true,
});

// Stripe Subscription Update Schema
export const updateStripeSubscriptionSchema =
  createStripeSubscriptionSchema.partial();

// Stripe Subscription Query Parameters Schema
export const stripeSubscriptionQuerySchema = z.object({
  status: z
    .enum([
      'active',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'past_due',
      'trialing',
      'unpaid',
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

// Stripe Subscription Path Parameters Schema
export const stripeSubscriptionParamsSchema = z.object({
  id: z.string().min(1),
});

// Type exports
export type StripeSubscription = z.infer<typeof stripeSubscriptionSchema>;
export type CreateStripeSubscription = z.infer<
  typeof createStripeSubscriptionSchema
>;
export type UpdateStripeSubscription = z.infer<
  typeof updateStripeSubscriptionSchema
>;
export type StripeSubscriptionQuery = z.infer<
  typeof stripeSubscriptionQuerySchema
>;
export type StripeSubscriptionParams = z.infer<
  typeof stripeSubscriptionParamsSchema
>;


