import { z } from 'zod';
import {
  nameValidator,
  paginatedQuerySchema,
} from '@/shared/validations/common';

export const createSettingSchema = z.object({
  name: nameValidator,
});

export const updateSettingSchema = createSettingSchema.partial();

export const settingQuerySchema = paginatedQuerySchema.extend({
  search: z.string().optional(),
});

export type CreateSettingRequest = z.infer<typeof createSettingSchema>;
export type UpdateSettingRequest = z.infer<typeof updateSettingSchema>;
export type SettingQueryParams = z.infer<typeof settingQuerySchema>;
