import { z } from 'zod';

// User Preferences Schema
export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
  defaultCurrency: z.string().optional(),
  dateFormat: z.string().optional(),
  timeFormat: z.enum(['12h', '24h']).optional(),
});

// User Profile Schema
export const userProfileSchema = z.object({
  bio: z.string().optional(),
  website: z.string().url().optional(),
  location: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  socialLinks: z
    .object({
      twitter: z.string().optional(),
      linkedin: z.string().optional(),
      github: z.string().optional(),
    })
    .optional(),
});

// User Privacy Schema
export const userPrivacySchema = z.object({
  profileVisibility: z.enum(['public', 'private', 'organization']).optional(),
  showEmail: z.boolean().optional(),
  showLocation: z.boolean().optional(),
  allowDirectMessages: z.boolean().optional(),
});

// Complete User Settings Schema
export const userSettingsSchema = z.object({
  preferences: userPreferencesSchema.optional(),
  profile: userProfileSchema.optional(),
  privacy: userPrivacySchema.optional(),
});

// User Settings Category Schema Map
export const userSettingsCategorySchemas = {
  preferences: userPreferencesSchema,
  profile: userProfileSchema,
  privacy: userPrivacySchema,
} as const;

// Type exports
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type UserPrivacy = z.infer<typeof userPrivacySchema>;
export type UserSettings = z.infer<typeof userSettingsSchema>;
export type UserSettingsCategory = keyof typeof userSettingsCategorySchemas;
