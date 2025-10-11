import {
  findByEntity,
  findByEntityAndCategory,
  upsert,
  addToHistory,
  getHistory,
} from '@/modules/settings/repositories/settings.repository';
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
import { EventType } from '@/shared/events/enums/event-types';
import type { FastifyInstance } from 'fastify';
import {
  publishUserEvent,
  publishPracticeEvent,
} from '@/shared/events/event-publisher';

type UpdateSettingsDto = {
  [key: string]: any;
};

// User Settings
export const getUserSettings = async (userId: string) => {
  const settings = await findByEntity('user', userId);

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
  fastify?: FastifyInstance,
) => {
  const result: any = {};

  // Update each category
  for (const [category, categoryData] of Object.entries(data)) {
    if (categoryData) {
      const oldSetting = await findByEntityAndCategory(
        'user',
        userId,
        category,
      );

      const oldValue = oldSetting?.data;

      await upsert({
        entityType: 'user',
        entityId: userId,
        category,
        data: categoryData,
      });

      // Add to history
      await addToHistory({
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

  // Publish user settings updated event
  if (fastify?.events) {
    await publishUserEvent(fastify, EventType.USER_SETTINGS_UPDATED, userId, {
      changedBy,
      categories: Object.keys(data),
      settings: result,
    });
  }

  return result;
};

export const updateUserSettingsCategory = async (
  userId: string,
  category: string,
  data: UpdateSettingsDto,
  changedBy: string,
) => {
  const oldSetting = await findByEntityAndCategory('user', userId, category);

  const oldValue = oldSetting?.data;

  await upsert({
    entityType: 'user',
    entityId: userId,
    category,
    data,
  });

  // Add to history
  await addToHistory({
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
  const settings = await findByEntity('organization', organizationId);

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
  fastify?: FastifyInstance,
) => {
  const result: any = {};

  // Update each category
  for (const [category, categoryData] of Object.entries(data)) {
    if (categoryData) {
      const oldSetting = await findByEntityAndCategory(
        'organization',
        organizationId,
        category,
      );

      const oldValue = oldSetting?.data;

      await upsert({
        entityType: 'organization',
        entityId: organizationId,
        category,
        data: categoryData,
      });

      // Add to history
      await addToHistory({
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

  // Publish practice settings updated event
  if (fastify?.events) {
    await publishPracticeEvent(
      fastify,
      EventType.PRACTICE_SETTINGS_UPDATED,
      changedBy,
      organizationId,
      {
        changedBy,
        categories: Object.keys(data),
        settings: result,
      },
    );
  }

  return result;
};

export const updateOrganizationSettingsCategory = async (
  organizationId: string,
  category: string,
  data: UpdateSettingsDto,
  changedBy: string,
) => {
  const oldSetting = await findByEntityAndCategory(
    'organization',
    organizationId,
    category,
  );

  const oldValue = oldSetting?.data;

  await upsert({
    entityType: 'organization',
    entityId: organizationId,
    category,
    data,
  });

  // Add to history
  await addToHistory({
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
  return getHistory(entityType, entityId, limit);
};
