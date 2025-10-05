import { z } from 'zod';

// Stripe Payout Schema
export const stripePayoutSchema = z.object({
  stripePayoutId: z.string().min(1),
  stripeAccountId: z.string().min(1),
  amount: z.number().min(0),
  currency: z.string().min(3).max(3),
  status: z.enum(['paid', 'pending', 'in_transit', 'canceled', 'failed']),
  arrivalDate: z.date(),
  description: z.string().optional(),
  statementDescriptor: z.string().optional(),
  teamId: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Stripe Payout Create Schema
export const createStripePayoutSchema = stripePayoutSchema.omit({
  createdAt: true,
  updatedAt: true,
});

// Stripe Payout Update Schema
export const updateStripePayoutSchema = createStripePayoutSchema.partial();

// Stripe Payout Query Parameters Schema
export const stripePayoutQuerySchema = z.object({
  status: z
    .enum(['paid', 'pending', 'in_transit', 'canceled', 'failed'])
    .optional(),
  stripeAccountId: z.string().optional(),
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

// Stripe Payout Path Parameters Schema
export const stripePayoutParamsSchema = z.object({
  id: z.string().min(1),
});

// Type exports
export type StripePayout = z.infer<typeof stripePayoutSchema>;
export type CreateStripePayout = z.infer<typeof createStripePayoutSchema>;
export type UpdateStripePayout = z.infer<typeof updateStripePayoutSchema>;
export type StripePayoutQuery = z.infer<typeof stripePayoutQuerySchema>;
export type StripePayoutParams = z.infer<typeof stripePayoutParamsSchema>;


