import { eq } from 'drizzle-orm';
import { db } from '@/database';
import { userSettings } from '../schema';

// User Settings Queries
export class UserSettingsQueries {
  // Create or update user settings
  static async upsertUserSettings(
    userId: string,
    settings: {
      preferences?: any;
      profile?: any;
      privacy?: any;
    },
  ) {
    const [existing] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(userSettings)
        .set({
          preferences: settings.preferences || existing.preferences,
          profile: settings.profile || existing.profile,
          privacy: settings.privacy || existing.privacy,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.id, existing.id))
        .returning();

      return updated;
    } else {
      const [created] = await db
        .insert(userSettings)
        .values({
          userId,
          preferences: settings.preferences,
          profile: settings.profile,
          privacy: settings.privacy,
        })
        .returning();

      return created;
    }
  }

  // Get user settings
  static async getUserSettings(userId: string) {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    return settings;
  }

  // Update specific category of user settings
  static async updateUserSettingsCategory(
    userId: string,
    category: 'preferences' | 'profile' | 'privacy',
    data: any,
  ) {
    const [existing] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (!existing) {
      // Create new settings with default values
      const [created] = await db
        .insert(userSettings)
        .values({
          userId,
          [category]: data,
        })
        .returning();

      return created;
    }

    const [updated] = await db
      .update(userSettings)
      .set({
        [category]: data,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.id, existing.id))
      .returning();

    return updated;
  }

  // Delete user settings
  static async deleteUserSettings(userId: string) {
    await db.delete(userSettings).where(eq(userSettings.userId, userId));
  }

  // Get user settings by ID
  static async getUserSettingsById(settingsId: string) {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.id, settingsId))
      .limit(1);

    return settings;
  }

  // Get all user settings (for admin purposes)
  static async getAllUserSettings(limit = 100, offset = 0) {
    return await db.select().from(userSettings).limit(limit).offset(offset);
  }

  // Check if user has settings
  static async hasUserSettings(userId: string): Promise<boolean> {
    const [settings] = await db
      .select({ id: userSettings.id })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    return !!settings;
  }
}
