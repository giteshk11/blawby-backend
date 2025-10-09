import { pgTable, uuid, text, json, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Settings table for storing user and organization settings
export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(), // 'user' or 'organization'
  entityId: text('entity_id').notNull(), // User ID or Organization ID
  category: text('category').notNull(), // 'preferences', 'profile', 'privacy', etc.
  data: json('data').notNull(), // JSON data for the settings
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Settings history table for tracking changes
export const settingsHistory = pgTable('settings_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(), // 'user' or 'organization'
  entityId: text('entity_id').notNull(), // User ID or Organization ID
  changedBy: text('changed_by').notNull(), // User ID who made the change
  category: text('category').notNull(),
  oldValue: json('old_value'),
  newValue: json('new_value'),
  changeReason: text('change_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Settings schemas
export const insertSettingsSchema = createInsertSchema(settings, {
  entityType: z.enum(['user', 'organization']),
  entityId: z.string().min(1, 'Entity ID is required'),
  category: z.string().min(1, 'Category is required'),
  data: z.record(z.any()),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSettingsSchema = insertSettingsSchema.partial();

export const selectSettingsSchema = createSelectSchema(settings);

// Settings history schemas
export const insertSettingsHistorySchema = createInsertSchema(settingsHistory, {
  entityType: z.enum(['user', 'organization']),
  entityId: z.string().min(1, 'Entity ID is required'),
  changedBy: z.string().min(1, 'Changed by is required'),
  category: z.string().min(1, 'Category is required'),
}).omit({
  id: true,
  createdAt: true,
});

export const selectSettingsHistorySchema = createSelectSchema(settingsHistory);

// Infer types from schemas
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;
export type SelectSettings = z.infer<typeof selectSettingsSchema>;

export type InsertSettingsHistory = z.infer<typeof insertSettingsHistorySchema>;
export type SelectSettingsHistory = z.infer<typeof selectSettingsHistorySchema>;

// Default settings schemas for validation
export const userPreferencesSchema = {
  theme: 'system' as const,
  language: 'en' as const,
  timezone: 'UTC' as const,
  emailNotifications: true,
  pushNotifications: true,
  marketingEmails: false,
  twoFactorEnabled: false,
  defaultCurrency: 'USD' as const,
  dateFormat: 'MM/DD/YYYY' as const,
  timeFormat: '12h' as const,
};

export const userProfileSchema = {
  bio: '',
  website: '',
  location: '',
  company: '',
  jobTitle: '',
  socialLinks: {
    twitter: '',
    linkedin: '',
    github: '',
  },
};

export const userPrivacySchema = {
  profileVisibility: 'organization' as const,
  showEmail: false,
  showLocation: false,
  allowDirectMessages: true,
};

// Organization settings schemas
export const organizationGeneralSchema = {
  name: '',
  description: '',
  website: '',
  timezone: 'UTC' as const,
  defaultLanguage: 'en' as const,
  currency: 'USD' as const,
};

export const organizationNotificationsSchema = {
  emailNotifications: true,
  slackIntegration: false,
  webhookUrl: '',
  notificationChannels: ['email'] as string[],
};

export const organizationBillingSchema = {
  stripeCustomerId: '',
  subscriptionPlan: 'free' as const,
  billingEmail: '',
  taxId: '',
  billingAddress: {
    line1: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  },
};

export const organizationSecuritySchema = {
  requireTwoFactor: false,
  sessionTimeout: 480,
  allowedDomains: [] as string[],
  passwordPolicy: {
    minLength: 8,
    requireUppercase: false,
    requireLowercase: false,
    requireNumbers: false,
    requireSymbols: false,
  },
};

export const organizationIntegrationsSchema = {
  stripe: {
    connectedAccountId: '',
    webhookSecret: '',
    testMode: true,
  },
  slack: {
    workspaceId: '',
    botToken: '',
    channelId: '',
  },
};

export const organizationFeaturesSchema = {
  enabledFeatures: [] as string[],
  featureFlags: {
    'beta-features': false,
    'experimental-ui': false,
  },
  limits: {
    maxUsers: 10,
    maxProjects: 5,
    maxStorage: 1000,
  },
};
