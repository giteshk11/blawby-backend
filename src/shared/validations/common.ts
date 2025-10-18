import { z } from 'zod';

// Reusable validators
export const emailValidator = z
  .email('Invalid email format')
  .min(1, 'Email is required');

export const phoneValidator = z
  .string()
  .regex(/^\+?[\d\s-()]+$/, 'Invalid phone format')
  .min(1, 'Phone number is required');

export const urlValidator = z
  .url('Invalid URL format')
  .min(1, 'URL is required');

export const uuidValidator = z.uuid('Invalid UUID format');

export const currencyValidator = z
  .string()
  .regex(/^\$\d+(\.\d{2})?$/, 'Invalid currency format (use $XX.XX)');

export const slugValidator = z
  .string()
  .min(1, 'Slug is required')
  .max(50, 'Slug too long')
  .regex(
    /^[a-z0-9-]+$/,
    'Slug must contain only lowercase letters, numbers, and hyphens',
  );

export const nameValidator = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name too long');

// Common schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).optional(),
});

export const searchSchema = z.object({
  search: z.string().optional(),
  q: z.string().optional(),
});

export const idParamSchema = z.object({
  id: uuidValidator,
});

export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const bulkActionSchema = z.object({
  ids: z.array(uuidValidator).min(1, 'At least one ID is required'),
  action: z.string().min(1, 'Action is required'),
});

// Combined common schemas
export const paginatedQuerySchema = paginationSchema
  .merge(searchSchema)
  .merge(sortSchema);

export const dateFilteredQuerySchema =
  paginatedQuerySchema.merge(dateRangeSchema);
