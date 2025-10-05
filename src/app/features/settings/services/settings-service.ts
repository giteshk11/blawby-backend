import {
  UserSettingsQueries,
  OrganizationSettingsQueries,
  SettingsHistoryQueries,
} from 'features/settings/database/queries';
import type {
  UserPreferences,
  UserProfile,
  UserPrivacy,
  OrganizationGeneral,
  OrganizationNotifications,
  OrganizationBilling,
  OrganizationSecurity,
  OrganizationIntegrations,
  OrganizationFeatures,
} from 'features/settings/validation';

export class SettingsService {
  // User Settings Methods
  async getUserSettings(userId: string) {
    const settings = await UserSettingsQueries.getUserSettings(userId);

    if (!settings) {
      // Return default settings if none exist
      return this.getDefaultUserSettings();
    }

    return {
      preferences: settings.preferences || this.getDefaultUserPreferences(),
      profile: settings.profile || this.getDefaultUserProfile(),
      privacy: settings.privacy || this.getDefaultUserPrivacy(),
    };
  }

  async updateUserSettings(
    userId: string,
    settings: {
      preferences?: Partial<UserPreferences>;
      profile?: Partial<UserProfile>;
      privacy?: Partial<UserPrivacy>;
    },
    changedBy: string,
  ) {
    const existing = await UserSettingsQueries.getUserSettings(userId);

    // Record changes in history
    if (existing) {
      if (settings.preferences) {
        await SettingsHistoryQueries.recordSettingsChange(
          'user',
          userId,
          changedBy,
          'preferences',
          existing.preferences,
          settings.preferences,
        );
      }
      if (settings.profile) {
        await SettingsHistoryQueries.recordSettingsChange(
          'user',
          userId,
          changedBy,
          'profile',
          existing.profile,
          settings.profile,
        );
      }
      if (settings.privacy) {
        await SettingsHistoryQueries.recordSettingsChange(
          'user',
          userId,
          changedBy,
          'privacy',
          existing.privacy,
          settings.privacy,
        );
      }
    }

    return await UserSettingsQueries.upsertUserSettings(userId, settings);
  }

  async updateUserSettingsCategory(
    userId: string,
    category: 'preferences' | 'profile' | 'privacy',
    data: any,
    changedBy: string,
  ) {
    const existing = await UserSettingsQueries.getUserSettings(userId);

    // Record change in history
    if (existing) {
      await SettingsHistoryQueries.recordSettingsChange(
        'user',
        userId,
        changedBy,
        category,
        existing[category],
        data,
      );
    }

    return await UserSettingsQueries.updateUserSettingsCategory(
      userId,
      category,
      data,
    );
  }

  // Organization Settings Methods
  async getOrganizationSettings(organizationId: string) {
    const settings =
      await OrganizationSettingsQueries.getOrganizationSettings(organizationId);

    if (!settings) {
      // Return default settings if none exist
      return this.getDefaultOrganizationSettings();
    }

    return {
      general: settings.general || this.getDefaultOrganizationGeneral(),
      notifications:
        settings.notifications || this.getDefaultOrganizationNotifications(),
      billing: settings.billing || this.getDefaultOrganizationBilling(),
      security: settings.security || this.getDefaultOrganizationSecurity(),
      integrations:
        settings.integrations || this.getDefaultOrganizationIntegrations(),
      features: settings.features || this.getDefaultOrganizationFeatures(),
    };
  }

  async updateOrganizationSettings(
    organizationId: string,
    settings: {
      general?: Partial<OrganizationGeneral>;
      notifications?: Partial<OrganizationNotifications>;
      billing?: Partial<OrganizationBilling>;
      security?: Partial<OrganizationSecurity>;
      integrations?: Partial<OrganizationIntegrations>;
      features?: Partial<OrganizationFeatures>;
    },
    changedBy: string,
  ) {
    const existing =
      await OrganizationSettingsQueries.getOrganizationSettings(organizationId);

    // Record changes in history
    if (existing) {
      Object.entries(settings).forEach(([category, data]) => {
        if (data) {
          SettingsHistoryQueries.recordSettingsChange(
            'organization',
            organizationId,
            changedBy,
            category,
            existing[category as keyof typeof existing],
            data,
          );
        }
      });
    }

    return await OrganizationSettingsQueries.upsertOrganizationSettings(
      organizationId,
      settings,
    );
  }

  async updateOrganizationSettingsCategory(
    organizationId: string,
    category:
      | 'general'
      | 'notifications'
      | 'billing'
      | 'security'
      | 'integrations'
      | 'features',
    data: any,
    changedBy: string,
  ) {
    const existing =
      await OrganizationSettingsQueries.getOrganizationSettings(organizationId);

    // Record change in history
    if (existing) {
      await SettingsHistoryQueries.recordSettingsChange(
        'organization',
        organizationId,
        changedBy,
        category,
        existing[category],
        data,
      );
    }

    return await OrganizationSettingsQueries.updateOrganizationSettingsCategory(
      organizationId,
      category,
      data,
    );
  }

  // History Methods
  async getSettingsHistory(
    entityType: 'user' | 'organization',
    entityId: string,
    limit = 50,
  ) {
    return await SettingsHistoryQueries.getSettingsHistory(
      entityType,
      entityId,
      limit,
    );
  }

  // Default Settings Methods
  private getDefaultUserSettings() {
    return {
      preferences: this.getDefaultUserPreferences(),
      profile: this.getDefaultUserProfile(),
      privacy: this.getDefaultUserPrivacy(),
    };
  }

  private getDefaultUserPreferences(): UserPreferences {
    return {
      theme: 'system',
      language: 'en',
      timezone: 'UTC',
      emailNotifications: true,
      pushNotifications: true,
      marketingEmails: false,
      twoFactorEnabled: false,
      defaultCurrency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
    };
  }

  private getDefaultUserProfile(): UserProfile {
    return {
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
  }

  private getDefaultUserPrivacy(): UserPrivacy {
    return {
      profileVisibility: 'organization',
      showEmail: false,
      showLocation: false,
      allowDirectMessages: true,
    };
  }

  private getDefaultOrganizationSettings() {
    return {
      general: this.getDefaultOrganizationGeneral(),
      notifications: this.getDefaultOrganizationNotifications(),
      billing: this.getDefaultOrganizationBilling(),
      security: this.getDefaultOrganizationSecurity(),
      integrations: this.getDefaultOrganizationIntegrations(),
      features: this.getDefaultOrganizationFeatures(),
    };
  }

  private getDefaultOrganizationGeneral(): OrganizationGeneral {
    return {
      name: '',
      description: '',
      website: '',
      logo: '',
      timezone: 'UTC',
      defaultLanguage: 'en',
      currency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
    };
  }

  private getDefaultOrganizationNotifications(): OrganizationNotifications {
    return {
      emailNotifications: true,
      slackIntegration: false,
      webhookUrl: '',
      notificationChannels: ['email'],
    };
  }

  private getDefaultOrganizationBilling(): OrganizationBilling {
    return {
      stripeCustomerId: '',
      subscriptionPlan: 'free',
      billingEmail: '',
      taxId: '',
      billingAddress: {
        line1: '',
        line2: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      },
    };
  }

  private getDefaultOrganizationSecurity(): OrganizationSecurity {
    return {
      requireTwoFactor: false,
      sessionTimeout: 480, // 8 hours
      allowedDomains: [],
      ipWhitelist: [],
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: false,
      },
    };
  }

  private getDefaultOrganizationIntegrations(): OrganizationIntegrations {
    return {
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
      github: {
        organizationId: '',
        accessToken: '',
      },
    };
  }

  private getDefaultOrganizationFeatures(): OrganizationFeatures {
    return {
      enabledFeatures: ['basic'],
      featureFlags: {},
      limits: {
        maxUsers: 5,
        maxProjects: 3,
        maxStorage: 1000, // 1GB
      },
    };
  }
}
