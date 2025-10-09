import { db } from '@/database';
import { practiceDetails } from '../schemas/practice.schema';
import { eq } from 'drizzle-orm';
import type {
  InsertPracticeDetails,
  UpdatePracticeDetails,
} from '../schemas/practice.schema';

export const createPracticeDetails = async (
  data: InsertPracticeDetails & {
    organizationId: string;
    userId: string;
  },
) => {
  const [practiceDetail] = await db
    .insert(practiceDetails)
    .values(data)
    .returning();
  return practiceDetail;
};

export const findPracticeDetailsByOrganization = async (
  organizationId: string,
) => {
  const [practiceDetail] = await db
    .select()
    .from(practiceDetails)
    .where(eq(practiceDetails.organizationId, organizationId))
    .limit(1);
  return practiceDetail;
};

export const updatePracticeDetails = async (
  organizationId: string,
  data: UpdatePracticeDetails,
) => {
  const [practiceDetail] = await db
    .update(practiceDetails)
    .set(data)
    .where(eq(practiceDetails.organizationId, organizationId))
    .returning();
  return practiceDetail;
};

export const deletePracticeDetails = async (organizationId: string) => {
  await db
    .delete(practiceDetails)
    .where(eq(practiceDetails.organizationId, organizationId));
};
