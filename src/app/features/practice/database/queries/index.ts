import { eq } from 'drizzle-orm';
import { db } from '@/database';
import { practiceDetails } from 'features/practice/database/schema';

// Types for practice details
export type PracticeDetails = typeof practiceDetails.$inferSelect;
export type CreatePracticeDetails = typeof practiceDetails.$inferInsert;
export type UpdatePracticeDetails = Partial<
  Omit<
    CreatePracticeDetails,
    'id' | 'organizationId' | 'createdAt' | 'updatedAt'
  >
>;

/**
 * Create practice details for an organization
 */
export const createPracticeDetails = async (
  data: CreatePracticeDetails,
): Promise<PracticeDetails> => {
  const [practiceDetail] = await db
    .insert(practiceDetails)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return practiceDetail;
};

/**
 * Get practice details by organization ID
 */
export const getPracticeDetails = async (
  organizationId: string,
): Promise<PracticeDetails | null> => {
  const [practiceDetail] = await db
    .select()
    .from(practiceDetails)
    .where(eq(practiceDetails.organizationId, organizationId))
    .limit(1);

  return practiceDetail || null;
};

/**
 * Update practice details for an organization
 */
export const updatePracticeDetails = async (
  organizationId: string,
  data: UpdatePracticeDetails,
): Promise<PracticeDetails | null> => {
  const [updatedPracticeDetail] = await db
    .update(practiceDetails)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(practiceDetails.organizationId, organizationId))
    .returning();

  return updatedPracticeDetail || null;
};

/**
 * Upsert practice details (create or update)
 */
export const upsertPracticeDetails = async (
  organizationId: string,
  data: UpdatePracticeDetails,
): Promise<PracticeDetails> => {
  const existing = await getPracticeDetails(organizationId);

  if (existing) {
    const updated = await updatePracticeDetails(organizationId, data);
    return updated!;
  } else {
    return await createPracticeDetails({
      organizationId,
      ...data,
    });
  }
};

/**
 * Delete practice details for an organization
 */
export const deletePracticeDetails = async (
  organizationId: string,
): Promise<boolean> => {
  const result = await db
    .delete(practiceDetails)
    .where(eq(practiceDetails.organizationId, organizationId));

  return (result.rowCount ?? 0) > 0;
};

/**
 * Check if practice details exist for an organization
 */
export const hasPracticeDetails = async (
  organizationId: string,
): Promise<boolean> => {
  const practiceDetail = await getPracticeDetails(organizationId);
  return practiceDetail !== null;
};

/**
 * Get all practice details
 */
export const getAllPracticeDetails = async (): Promise<PracticeDetails[]> => {
  return await db.select().from(practiceDetails);
};

/**
 * Get practice details by ID
 */
export const getPracticeDetailsById = async (
  id: string,
): Promise<PracticeDetails | null> => {
  const [practiceDetail] = await db
    .select()
    .from(practiceDetails)
    .where(eq(practiceDetails.id, id))
    .limit(1);

  return practiceDetail || null;
};
