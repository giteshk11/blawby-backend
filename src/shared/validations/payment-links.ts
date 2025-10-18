import { z } from 'zod';

export const createPaymentLinkSchema = z.object({
  organizationId: z.uuid(),
  amount: z.number().int().min(50).max(99999900), // $0.50 to $999,999
  email: z.email(),
  name: z.string().min(1).max(255),
  onBehalfOf: z.string().max(255).optional(),
});

export const updatePaymentLinkSchema = z.object({
  paymentIntentId: z.string().min(1),
  amount: z.number().int().min(50).max(99999900),
});

export const paymentLinkSettingsSchema = z.object({
  enabled: z.boolean(),
  prefillAmount: z.number().int().min(0).optional(),
});
