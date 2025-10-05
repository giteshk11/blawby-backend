import { z } from 'zod';

// Settings History Query Parameters Schema
export const settingsHistoryQuerySchema = z.object({
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(100))
    .optional(),
});

// Settings History Path Parameters Schema
export const settingsHistoryParamsSchema = z.object({
  entityType: z.enum(['user', 'organization']),
  entityId: z.string().min(1),
});

// User Settings Category Path Parameters Schema
export const userSettingsCategoryParamsSchema = z.object({
  category: z.enum(['preferences', 'profile', 'privacy']),
});

// Organization Settings Path Parameters Schema
export const organizationSettingsParamsSchema = z.object({
  organizationId: z.string().min(1),
});

// Organization Settings Category Path Parameters Schema
export const organizationSettingsCategoryParamsSchema = z.object({
  organizationId: z.string().min(1),
  category: z.enum([
    'general',
    'notifications',
    'billing',
    'security',
    'integrations',
    'features',
  ]),
});

// Common Response Schemas
export const successResponseSchema = z.object({
  data: z.any(),
});

export const errorResponseSchema = z.object({
  error: z.string(),
});

// Type exports
export type SettingsHistoryQuery = z.infer<typeof settingsHistoryQuerySchema>;
export type SettingsHistoryParams = z.infer<typeof settingsHistoryParamsSchema>;
export type UserSettingsCategoryParams = z.infer<
  typeof userSettingsCategoryParamsSchema
>;
export type OrganizationSettingsParams = z.infer<
  typeof organizationSettingsParamsSchema
>;
export type OrganizationSettingsCategoryParams = z.infer<
  typeof organizationSettingsCategoryParamsSchema
>;
export type SuccessResponse = z.infer<typeof successResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
