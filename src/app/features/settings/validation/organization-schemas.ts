import { z } from 'zod';

// Organization General Schema
export const organizationGeneralSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  website: z.string().url().optional(),
  logo: z.string().url().optional(),
  timezone: z.string().optional(),
  defaultLanguage: z.string().optional(),
  currency: z.string().optional(),
  dateFormat: z.string().optional(),
  timeFormat: z.enum(['12h', '24h']).optional(),
});

// Organization Notifications Schema
export const organizationNotificationsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  slackIntegration: z.boolean().optional(),
  webhookUrl: z.string().url().optional(),
  notificationChannels: z.array(z.string()).optional(),
});

// Organization Billing Schema
export const organizationBillingSchema = z.object({
  stripeCustomerId: z.string().optional(),
  subscriptionPlan: z.string().optional(),
  billingEmail: z.string().email().optional(),
  taxId: z.string().optional(),
  billingAddress: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
});

// Organization Security Schema
export const organizationSecuritySchema = z.object({
  requireTwoFactor: z.boolean().optional(),
  sessionTimeout: z.number().min(1).max(1440).optional(), // 1 minute to 24 hours
  allowedDomains: z.array(z.string()).optional(),
  ipWhitelist: z.array(z.string()).optional(),
  passwordPolicy: z
    .object({
      minLength: z.number().min(6).max(128).optional(),
      requireUppercase: z.boolean().optional(),
      requireLowercase: z.boolean().optional(),
      requireNumbers: z.boolean().optional(),
      requireSymbols: z.boolean().optional(),
    })
    .optional(),
});

// Organization Integrations Schema
export const organizationIntegrationsSchema = z.object({
  stripe: z
    .object({
      connectedAccountId: z.string().optional(),
      webhookSecret: z.string().optional(),
      testMode: z.boolean().optional(),
    })
    .optional(),
  slack: z
    .object({
      workspaceId: z.string().optional(),
      botToken: z.string().optional(),
      channelId: z.string().optional(),
    })
    .optional(),
  github: z
    .object({
      organizationId: z.string().optional(),
      accessToken: z.string().optional(),
    })
    .optional(),
});

// Organization Features Schema
export const organizationFeaturesSchema = z.object({
  enabledFeatures: z.array(z.string()).optional(),
  featureFlags: z.record(z.string(), z.boolean()).optional(),
  limits: z
    .object({
      maxUsers: z.number().min(1).optional(),
      maxProjects: z.number().min(1).optional(),
      maxStorage: z.number().min(1).optional(),
    })
    .optional(),
});

// Complete Organization Settings Schema
export const organizationSettingsSchema = z.object({
  general: organizationGeneralSchema.optional(),
  notifications: organizationNotificationsSchema.optional(),
  billing: organizationBillingSchema.optional(),
  security: organizationSecuritySchema.optional(),
  integrations: organizationIntegrationsSchema.optional(),
  features: organizationFeaturesSchema.optional(),
});

// Organization Settings Category Schema Map
export const organizationSettingsCategorySchemas = {
  general: organizationGeneralSchema,
  notifications: organizationNotificationsSchema,
  billing: organizationBillingSchema,
  security: organizationSecuritySchema,
  integrations: organizationIntegrationsSchema,
  features: organizationFeaturesSchema,
} as const;

// Type exports
export type OrganizationGeneral = z.infer<typeof organizationGeneralSchema>;
export type OrganizationNotifications = z.infer<
  typeof organizationNotificationsSchema
>;
export type OrganizationBilling = z.infer<typeof organizationBillingSchema>;
export type OrganizationSecurity = z.infer<typeof organizationSecuritySchema>;
export type OrganizationIntegrations = z.infer<
  typeof organizationIntegrationsSchema
>;
export type OrganizationFeatures = z.infer<typeof organizationFeaturesSchema>;
export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;
export type OrganizationSettingsCategory =
  keyof typeof organizationSettingsCategorySchemas;
