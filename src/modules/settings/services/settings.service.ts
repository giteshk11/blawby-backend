import { settingsRepository } from '../repositories/settings.repository';
import {
  userPreferencesSchema,
  userProfileSchema,
  userPrivacySchema,
  organizationGeneralSchema,
  organizationNotificationsSchema,
  organizationBillingSchema,
  organizationSecuritySchema,
  organizationIntegrationsSchema,
  organizationFeaturesSchema,
} from '../schemas/settings.schema';

type UpdateSettingsDto = {
  [key: string]: any;
};

// User Settings
export const getUserSettings = async (userId: string) => {
  const settings = await settingsRepository.findByEntity('user', userId);

  // Convert to object format
  const result: any = {};
  for (const setting of settings) {
    result[setting.category] = setting.data;
  }

  // Merge with defaults
  return {
    preferences: { ...userPreferencesSchema, ...result.preferences },
    profile: { ...userProfileSchema, ...result.profile },
    privacy: { ...userPrivacySchema, ...result.privacy },
  };
};

export const updateUserSettings = async (
  userId: string,
  data: UpdateSettingsDto,
  changedBy: string,
) => {
  const result: any = {};

  // Update each category
  for (const [category, categoryData] of Object.entries(data)) {
    if (categoryData) {
      const oldSetting = await settingsRepository.findByEntityAndCategory(
        'user',
        userId,
        category,
      );

      const oldValue = oldSetting?.data;

      await settingsRepository.upsert({
        entityType: 'user',
        entityId: userId,
        category,
        data: categoryData,
      });

      // Add to history
      await settingsRepository.addToHistory({
        entityType: 'user',
        entityId: userId,
        changedBy,
        category,
        oldValue,
        newValue: categoryData,
      });

      result[category] = categoryData;
    }
  }

  return result;
};

export const updateUserSettingsCategory = async (
  userId: string,
  category: string,
  data: UpdateSettingsDto,
  changedBy: string,
) => {
  const oldSetting = await settingsRepository.findByEntityAndCategory(
    'user',
    userId,
    category,
  );

  const oldValue = oldSetting?.data;

  await settingsRepository.upsert({
    entityType: 'user',
    entityId: userId,
    category,
    data,
  });

  // Add to history
  await settingsRepository.addToHistory({
    entityType: 'user',
    entityId: userId,
    changedBy,
    category,
    oldValue,
    newValue: data,
  });

  return data;
};

// Organization Settings
export const getOrganizationSettings = async (organizationId: string) => {
  const settings = await settingsRepository.findByEntity(
    'organization',
    organizationId,
  );

  // Convert to object format
  const result: any = {};
  for (const setting of settings) {
    result[setting.category] = setting.data;
  }

  // Merge with defaults
  return {
    general: { ...organizationGeneralSchema, ...result.general },
    notifications: {
      ...organizationNotificationsSchema,
      ...result.notifications,
    },
    billing: { ...organizationBillingSchema, ...result.billing },
    security: { ...organizationSecuritySchema, ...result.security },
    integrations: {
      ...organizationIntegrationsSchema,
      ...result.integrations,
    },
    features: { ...organizationFeaturesSchema, ...result.features },
  };
};

export const updateOrganizationSettings = async (
  organizationId: string,
  data: UpdateSettingsDto,
  changedBy: string,
) => {
  const result: any = {};

  // Update each category
  for (const [category, categoryData] of Object.entries(data)) {
    if (categoryData) {
      const oldSetting = await settingsRepository.findByEntityAndCategory(
        'organization',
        organizationId,
        category,
      );

      const oldValue = oldSetting?.data;

      await settingsRepository.upsert({
        entityType: 'organization',
        entityId: organizationId,
        category,
        data: categoryData,
      });

      // Add to history
      await settingsRepository.addToHistory({
        entityType: 'organization',
        entityId: organizationId,
        changedBy,
        category,
        oldValue,
        newValue: categoryData,
      });

      result[category] = categoryData;
    }
  }

  return result;
};

export const updateOrganizationSettingsCategory = async (
  organizationId: string,
  category: string,
  data: UpdateSettingsDto,
  changedBy: string,
) => {
  const oldSetting = await settingsRepository.findByEntityAndCategory(
    'organization',
    organizationId,
    category,
  );

  const oldValue = oldSetting?.data;

  await settingsRepository.upsert({
    entityType: 'organization',
    entityId: organizationId,
    category,
    data,
  });

  // Add to history
  await settingsRepository.addToHistory({
    entityType: 'organization',
    entityId: organizationId,
    changedBy,
    category,
    oldValue,
    newValue: data,
  });

  return data;
};

// Settings History
export const getSettingsHistory = async (
  entityType: 'user' | 'organization',
  entityId: string,
  limit: number = 50,
) => {
  return settingsRepository.getHistory(entityType, entityId, limit);
};
