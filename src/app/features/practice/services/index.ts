import {
  createPracticeDetails,
  getPracticeDetails,
  updatePracticeDetails,
  upsertPracticeDetails,
  deletePracticeDetails,
  hasPracticeDetails,
  getAllPracticeDetails,
  getPracticeDetailsById,
  type PracticeDetails,
  type CreatePracticeDetails,
  type UpdatePracticeDetails,
} from '../database/queries';
import { db } from '@/database';
import { organization } from '@/schema';
import { eq } from 'drizzle-orm';

export class PracticeService {
  /**
   * Create practice details for an organization
   */
  async createPracticeDetails(
    data: CreatePracticeDetails,
  ): Promise<PracticeDetails> {
    return await createPracticeDetails(data);
  }

  /**
   * Get practice details by organization ID
   */
  async getPracticeDetails(
    organizationId: string,
  ): Promise<PracticeDetails | null> {
    return await getPracticeDetails(organizationId);
  }

  /**
   * Get combined practice details and organization data
   * Merges data from both practice_details and organization tables
   */
  async getPracticeDetailsWithFallback(
    organizationId: string,
  ): Promise<any | null> {
    // Get organization data
    const orgData = await db
      .select()
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);

    if (!orgData[0]) {
      return null;
    }

    const org = orgData[0];

    // Get practice details (if they exist)
    const practiceDetails = await getPracticeDetails(organizationId);

    // Combine organization data with practice details
    const combinedData = {
      // Organization data
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      metadata: org.metadata,
      organizationCreatedAt: org.createdAt,

      // Practice details (if they exist)
      businessPhone: practiceDetails?.businessPhone || null,
      businessEmail: practiceDetails?.businessEmail || null,
      consultationFee: practiceDetails?.consultationFee || null,
      paymentUrl: practiceDetails?.paymentUrl || null,
      calendlyUrl: practiceDetails?.calendlyUrl || null,
      practiceDetailsCreatedAt: practiceDetails?.createdAt || null,
      practiceDetailsUpdatedAt: practiceDetails?.updatedAt || null,

      // Flags to indicate what data exists
      hasPracticeDetails: !!practiceDetails,
      practiceDetailsId: practiceDetails?.id || null,
    };

    return combinedData;
  }

  /**
   * Update practice details for an organization
   */
  async updatePracticeDetails(
    organizationId: string,
    data: UpdatePracticeDetails,
  ): Promise<PracticeDetails | null> {
    return await updatePracticeDetails(organizationId, data);
  }

  /**
   * Upsert practice details (create or update)
   */
  async upsertPracticeDetails(
    organizationId: string,
    data: UpdatePracticeDetails,
  ): Promise<PracticeDetails> {
    return await upsertPracticeDetails(organizationId, data);
  }

  /**
   * Delete practice details for an organization
   */
  async deletePracticeDetails(organizationId: string): Promise<boolean> {
    return await deletePracticeDetails(organizationId);
  }

  /**
   * Check if practice details exist for an organization
   */
  async hasPracticeDetails(organizationId: string): Promise<boolean> {
    return await hasPracticeDetails(organizationId);
  }

  /**
   * Get all practice details
   */
  async getAllPracticeDetails(): Promise<PracticeDetails[]> {
    return await getAllPracticeDetails();
  }

  /**
   * Get practice details by ID
   */
  async getPracticeDetailsById(id: string): Promise<PracticeDetails | null> {
    return await getPracticeDetailsById(id);
  }
}
