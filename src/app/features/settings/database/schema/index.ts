import {
  pgTable,
  text,
  timestamp,
  uuid,
  json,
  boolean,
} from 'drizzle-orm/pg-core';

// User Settings table
export const userSettings = pgTable('user_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(), // References Better Auth user.id
  preferences: json('preferences').$type<{
    theme?: 'light' | 'dark' | 'system';
    language?: string;
    timezone?: string;
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    marketingEmails?: boolean;
    twoFactorEnabled?: boolean;
    defaultCurrency?: string;
    dateFormat?: string;
    timeFormat?: '12h' | '24h';
  }>(),
  profile: json('profile').$type<{
    bio?: string;
    website?: string;
    location?: string;
    company?: string;
    jobTitle?: string;
    socialLinks?: {
      twitter?: string;
      linkedin?: string;
      github?: string;
    };
  }>(),
  privacy: json('privacy').$type<{
    profileVisibility?: 'public' | 'private' | 'organization';
    showEmail?: boolean;
    showLocation?: boolean;
    allowDirectMessages?: boolean;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Organization Settings table
export const organizationSettings = pgTable('organization_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: text('organization_id').notNull().unique(), // References Better Auth organization.id
  general: json('general').$type<{
    name?: string;
    description?: string;
    website?: string;
    logo?: string;
    timezone?: string;
    defaultLanguage?: string;
    currency?: string;
    dateFormat?: string;
    timeFormat?: '12h' | '24h';
  }>(),
  notifications: json('notifications').$type<{
    emailNotifications?: boolean;
    slackIntegration?: boolean;
    webhookUrl?: string;
    notificationChannels?: string[];
  }>(),
  billing: json('billing').$type<{
    stripeCustomerId?: string;
    subscriptionPlan?: string;
    billingEmail?: string;
    taxId?: string;
    billingAddress?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  }>(),
  security: json('security').$type<{
    requireTwoFactor?: boolean;
    sessionTimeout?: number; // minutes
    allowedDomains?: string[];
    ipWhitelist?: string[];
    passwordPolicy?: {
      minLength?: number;
      requireUppercase?: boolean;
      requireLowercase?: boolean;
      requireNumbers?: boolean;
      requireSymbols?: boolean;
    };
  }>(),
  integrations: json('integrations').$type<{
    stripe?: {
      connectedAccountId?: string;
      webhookSecret?: string;
      testMode?: boolean;
    };
    slack?: {
      workspaceId?: string;
      botToken?: string;
      channelId?: string;
    };
    github?: {
      organizationId?: string;
      accessToken?: string;
    };
  }>(),
  features: json('features').$type<{
    enabledFeatures?: string[];
    featureFlags?: Record<string, boolean>;
    limits?: {
      maxUsers?: number;
      maxProjects?: number;
      maxStorage?: number; // in MB
    };
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Settings Templates table (for default settings)
export const settingsTemplates = pgTable('settings_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'user' or 'organization'
  category: text('category').notNull(), // 'preferences', 'security', etc.
  settings: json('settings').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Settings History table (for audit trail)
export const settingsHistory = pgTable('settings_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(), // 'user' or 'organization'
  entityId: text('entity_id').notNull(),
  changedBy: text('changed_by').notNull(), // user ID who made the change
  category: text('category').notNull(),
  oldValue: json('old_value'),
  newValue: json('new_value'),
  changeReason: text('change_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Export schema object for Drizzle
export const settingsSchema = {
  userSettings,
  organizationSettings,
  settingsTemplates,
  settingsHistory,
};
