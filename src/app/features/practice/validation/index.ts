import { z } from 'zod';

// Practice details schemas
export const practiceDetailsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  businessPhone: z.string().optional(),
  businessEmail: z.string().email().optional(),
  consultationFee: z.string().optional(),
  paymentUrl: z.string().url().optional(),
  calendlyUrl: z.string().url().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createPracticeDetailsSchema = z.object({
  organizationId: z.string().min(1),
  businessPhone: z.string().optional(),
  businessEmail: z.string().email().optional(),
  consultationFee: z.string().optional(),
  paymentUrl: z.string().url().optional(),
  calendlyUrl: z.string().url().optional(),
});

export const updatePracticeDetailsSchema = z.object({
  businessPhone: z.string().optional(),
  businessEmail: z.string().email().optional(),
  consultationFee: z.string().optional(),
  paymentUrl: z.string().url().optional(),
  calendlyUrl: z.string().url().optional(),
});

// Practice business info schema
export const practiceBusinessInfoSchema = z.object({
  businessPhone: z.string().optional(),
  businessEmail: z.string().email().optional(),
  consultationFee: z.string().optional(),
  paymentUrl: z.string().url().optional(),
  calendlyUrl: z.string().url().optional(),
});

// Practice onboarding schema
export const practiceOnboardingSchema = z.object({
  organizationId: z.string().min(1),
  businessInfo: practiceBusinessInfoSchema,
});

// Auth forwarding schemas (for Better Auth organization endpoints)
export const createPracticeSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  logo: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

export const updatePracticeSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  logo: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member']).optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
});

// API response schemas
export const practiceDetailsResponseSchema = z.object({
  data: practiceDetailsSchema,
});

export const practiceDetailsListResponseSchema = z.object({
  data: z.array(practiceDetailsSchema),
});

// Error response schema
export const practiceErrorResponseSchema = z.object({
  error: z.string(),
});
