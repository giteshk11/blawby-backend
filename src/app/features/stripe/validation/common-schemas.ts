import { z } from 'zod';

// Common Stripe API schemas
export const stripeApiResponseSchema = z.object({
  data: z.any(),
  message: z.string().optional(),
});

export const stripeApiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.any().optional(),
});

// Stripe webhook event schema
export const stripeWebhookEventSchema = z.object({
  id: z.string(),
  object: z.literal('event'),
  api_version: z.string().optional(),
  created: z.number(),
  data: z.object({
    object: z.any(),
    previous_attributes: z.any().optional(),
  }),
  livemode: z.boolean(),
  pending_webhooks: z.number(),
  request: z
    .object({
      id: z.string().nullable(),
      idempotency_key: z.string().nullable(),
    })
    .nullable(),
  type: z.string(),
});

// Stripe pagination schema
export const stripePaginationSchema = z.object({
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

// Stripe date range schema
export const stripeDateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Stripe amount schema
export const stripeAmountSchema = z.object({
  amount: z.number().min(0),
  currency: z.string().min(3).max(3),
});

// Type exports
export type StripeApiResponse = z.infer<typeof stripeApiResponseSchema>;
export type StripeApiError = z.infer<typeof stripeApiErrorSchema>;
export type StripeWebhookEvent = z.infer<typeof stripeWebhookEventSchema>;
export type StripePagination = z.infer<typeof stripePaginationSchema>;
export type StripeDateRange = z.infer<typeof stripeDateRangeSchema>;
export type StripeAmount = z.infer<typeof stripeAmountSchema>;


