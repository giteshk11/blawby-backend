import { eq } from 'drizzle-orm';
import { db } from '@/database';
import { organizationSettings } from '../schema';

// Organization Settings Queries
export class OrganizationSettingsQueries {
  // Create or update organization settings
  static async upsertOrganizationSettings(
    organizationId: string,
    settings: {
      general?: any;
      notifications?: any;
      billing?: any;
      security?: any;
      integrations?: any;
      features?: any;
    },
  ) {
    const [existing] = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(organizationSettings)
        .set({
          general: settings.general || existing.general,
          notifications: settings.notifications || existing.notifications,
          billing: settings.billing || existing.billing,
          security: settings.security || existing.security,
          integrations: settings.integrations || existing.integrations,
          features: settings.features || existing.features,
          updatedAt: new Date(),
        })
        .where(eq(organizationSettings.id, existing.id))
        .returning();

      return updated;
    } else {
      const [created] = await db
        .insert(organizationSettings)
        .values({
          organizationId,
          general: settings.general,
          notifications: settings.notifications,
          billing: settings.billing,
          security: settings.security,
          integrations: settings.integrations,
          features: settings.features,
        })
        .returning();

      return created;
    }
  }

  // Get organization settings
  static async getOrganizationSettings(organizationId: string) {
    const [settings] = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1);

    return settings;
  }

  // Update specific category of organization settings
  static async updateOrganizationSettingsCategory(
    organizationId: string,
    category:
      | 'general'
      | 'notifications'
      | 'billing'
      | 'security'
      | 'integrations'
      | 'features',
    data: any,
  ) {
    const [existing] = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1);

    if (!existing) {
      // Create new settings with default values
      const [created] = await db
        .insert(organizationSettings)
        .values({
          organizationId,
          [category]: data,
        })
        .returning();

      return created;
    }

    const [updated] = await db
      .update(organizationSettings)
      .set({
        [category]: data,
        updatedAt: new Date(),
      })
      .where(eq(organizationSettings.id, existing.id))
      .returning();

    return updated;
  }

  // Delete organization settings
  static async deleteOrganizationSettings(organizationId: string) {
    await db
      .delete(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId));
  }

  // Get organization settings by ID
  static async getOrganizationSettingsById(settingsId: string) {
    const [settings] = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.id, settingsId))
      .limit(1);

    return settings;
  }

  // Get all organization settings (for admin purposes)
  static async getAllOrganizationSettings(limit = 100, offset = 0) {
    return await db
      .select()
      .from(organizationSettings)
      .limit(limit)
      .offset(offset);
  }

  // Check if organization has settings
  static async hasOrganizationSettings(
    organizationId: string,
  ): Promise<boolean> {
    const [settings] = await db
      .select({ id: organizationSettings.id })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1);

    return !!settings;
  }

  // Get organization settings by specific field
  static async getOrganizationSettingsByField(
    organizationId: string,
    field:
      | 'general'
      | 'notifications'
      | 'billing'
      | 'security'
      | 'integrations'
      | 'features',
  ) {
    const [settings] = await db
      .select({ [field]: organizationSettings[field] })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1);

    return settings?.[field];
  }
}
