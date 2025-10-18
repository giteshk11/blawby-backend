import { db } from '@/shared/database';
import { settings, settingsHistory } from '../schemas/settings.schema';
import { eq, and, desc } from 'drizzle-orm';

// Get all settings for an entity
export const findByEntity = async (entityType: string, entityId: string) => {
  return db
    .select()
    .from(settings)
    .where(
      and(eq(settings.entityType, entityType), eq(settings.entityId, entityId)),
    );
};

// Get settings for a specific category
export const findByEntityAndCategory = async (
  entityType: string,
  entityId: string,
  category: string,
) => {
  const results = await db
    .select()
    .from(settings)
    .where(
      and(
        eq(settings.entityType, entityType),
        eq(settings.entityId, entityId),
        eq(settings.category, category),
      ),
    )
    .limit(1);

  return results[0] || null;
};

// Create or update settings
export const upsert = async (data: {
  entityType: string;
  entityId: string;
  category: string;
  data: any;
}) => {
  const existing = await findByEntityAndCategory(
    data.entityType,
    data.entityId,
    data.category,
  );

  if (existing) {
    const results = await db
      .update(settings)
      .set({
        data: data.data,
        updatedAt: new Date(),
      })
      .where(eq(settings.id, existing.id))
      .returning();

    return results[0];
  } else {
    const results = await db.insert(settings).values(data).returning();
    return results[0];
  }
};

// Delete settings
export const deleteSettings = async (
  entityType: string,
  entityId: string,
  category: string,
) => {
  await db
    .delete(settings)
    .where(
      and(
        eq(settings.entityType, entityType),
        eq(settings.entityId, entityId),
        eq(settings.category, category),
      ),
    );
};

// Get settings history
export const getHistory = async (
  entityType: string,
  entityId: string,
  limit: number = 50,
) => {
  return db
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
};

// Add to history
export const addToHistory = async (data: {
  entityType: string;
  entityId: string;
  changedBy: string;
  category: string;
  oldValue?: any;
  newValue?: any;
  changeReason?: string;
}) => {
  const results = await db.insert(settingsHistory).values(data).returning();
  return results[0];
};
