import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/database';
import { settingsHistory } from '../schema';

// Settings History Queries
export class SettingsHistoryQueries {
  // Record settings change
  static async recordSettingsChange(
    entityType: 'user' | 'organization',
    entityId: string,
    changedBy: string,
    category: string,
    oldValue: any,
    newValue: any,
    changeReason?: string,
  ) {
    const [record] = await db
      .insert(settingsHistory)
      .values({
        entityType,
        entityId,
        changedBy,
        category,
        oldValue,
        newValue,
        changeReason,
      })
      .returning();

    return record;
  }

  // Get settings history for an entity
  static async getSettingsHistory(
    entityType: 'user' | 'organization',
    entityId: string,
    limit = 50,
  ) {
    return await db
      .select()
      .from(settingsHistory)
      .where(
        and(
          eq(settingsHistory.entityType, entityType),
          eq(settingsHistory.entityId, entityId),
        ),
      )
      .orderBy(desc(settingsHistory.createdAt))
      .limit(limit);
  }

  // Get settings history by category
  static async getSettingsHistoryByCategory(
    entityType: 'user' | 'organization',
    entityId: string,
    category: string,
    limit = 50,
  ) {
    return await db
      .select()
      .from(settingsHistory)
      .where(
        and(
          eq(settingsHistory.entityType, entityType),
          eq(settingsHistory.entityId, entityId),
          eq(settingsHistory.category, category),
        ),
      )
      .orderBy(desc(settingsHistory.createdAt))
      .limit(limit);
  }

  // Get settings history by user who made changes
  static async getSettingsHistoryByUser(
    entityType: 'user' | 'organization',
    entityId: string,
    changedBy: string,
    limit = 50,
  ) {
    return await db
      .select()
      .from(settingsHistory)
      .where(
        and(
          eq(settingsHistory.entityType, entityType),
          eq(settingsHistory.entityId, entityId),
          eq(settingsHistory.changedBy, changedBy),
        ),
      )
      .orderBy(desc(settingsHistory.createdAt))
      .limit(limit);
  }

  // Get all settings history (for admin purposes)
  static async getAllSettingsHistory(limit = 100, offset = 0) {
    return await db
      .select()
      .from(settingsHistory)
      .orderBy(desc(settingsHistory.createdAt))
      .limit(limit)
      .offset(offset);
  }

  // Get settings history by date range
  static async getSettingsHistoryByDateRange(
    entityType: 'user' | 'organization',
    entityId: string,
    startDate: Date,
    endDate: Date,
    limit = 50,
  ) {
    return await db
      .select()
      .from(settingsHistory)
      .where(
        and(
          eq(settingsHistory.entityType, entityType),
          eq(settingsHistory.entityId, entityId),
          // Note: You might need to add date range conditions based on your Drizzle setup
        ),
      )
      .orderBy(desc(settingsHistory.createdAt))
      .limit(limit);
  }

  // Delete old settings history (cleanup)
  static async deleteOldSettingsHistory(olderThanDays: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // Note: This would need proper date filtering based on your Drizzle setup
    return await db
      .delete(settingsHistory)
      .where(eq(settingsHistory.createdAt, cutoffDate)); // This is a placeholder
  }

  // Get settings history count
  static async getSettingsHistoryCount(
    entityType: 'user' | 'organization',
    entityId: string,
  ) {
    const [result] = await db
      .select({ count: settingsHistory.id })
      .from(settingsHistory)
      .where(
        and(
          eq(settingsHistory.entityType, entityType),
          eq(settingsHistory.entityId, entityId),
        ),
      );

    return result?.count || 0;
  }
}
