import { z } from 'zod';

// Stripe Usage Event Schema
export const stripeUsageEventSchema = z.object({
  stripeUsageEventId: z.string().min(1),
  stripeCustomerId: z.string().min(1),
  trackStripeSubscriptionId: z.string().min(1),
  quantity: z.number().min(0),
  timestamp: z.date(),
  action: z.enum(['increment', 'set']),
  connectedAccountId: z.string().optional(),
  teamId: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Stripe Usage Event Create Schema
export const createStripeUsageEventSchema = stripeUsageEventSchema.omit({
  createdAt: true,
  updatedAt: true,
});

// Stripe Usage Event Update Schema
export const updateStripeUsageEventSchema =
  createStripeUsageEventSchema.partial();

// Stripe Usage Event Query Parameters Schema
export const stripeUsageEventQuerySchema = z.object({
  stripeCustomerId: z.string().optional(),
  trackStripeSubscriptionId: z.string().optional(),
  connectedAccountId: z.string().optional(),
  teamId: z.string().optional(),
  action: z.enum(['increment', 'set']).optional(),
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

// Stripe Usage Event Path Parameters Schema
export const stripeUsageEventParamsSchema = z.object({
  id: z.string().min(1),
});

// Type exports
export type StripeUsageEvent = z.infer<typeof stripeUsageEventSchema>;
export type CreateStripeUsageEvent = z.infer<
  typeof createStripeUsageEventSchema
>;
export type UpdateStripeUsageEvent = z.infer<
  typeof updateStripeUsageEventSchema
>;
export type StripeUsageEventQuery = z.infer<typeof stripeUsageEventQuerySchema>;
export type StripeUsageEventParams = z.infer<
  typeof stripeUsageEventParamsSchema
>;


