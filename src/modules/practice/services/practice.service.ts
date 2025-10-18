import {
  createOrganization,
  listOrganizations,
  getFullOrganization,
  updateOrganization,
  deleteOrganization,
  setActiveOrganization,
} from '@/modules/practice/services/organization.service';
import {
  createPracticeDetails,
  findPracticeDetailsByOrganization,
  upsertPracticeDetails,
  deletePracticeDetails,
} from '@/modules/practice/database/queries/practice-details.repository';
import { organizations } from '@/schema/better-auth-schema';
import { eq } from 'drizzle-orm';
import type {
  PracticeCreateRequest,
  PracticeUpdateRequest,
  PracticeWithDetails,
  UpdateOrganizationRequest,
  OrganizationListItem,
} from '@/modules/practice/types/practice.types';
import type { FastifyInstance } from 'fastify';
import { EventType } from '@/shared/events/enums/event-types';
import { publishEvent } from '@/shared/events/dispatcher';
import { sanitizeError } from '@/shared/utils/logging';
import { omit } from 'es-toolkit/compat';
import type { User } from 'better-auth';

// Practice service functions (practice = organization + optional practice details)
export const listPractices = async (
  user: User,
  fastify: FastifyInstance,
  requestHeaders: Record<string, string>,
): Promise<OrganizationListItem[]> => {
  // Forward to Better Auth org plugin
  return listOrganizations(user, fastify, requestHeaders);
};

export const getPracticeById = async (
  organizationId: string,
  user: User,
  fastify: FastifyInstance,
  requestHeaders: Record<string, string>,
): Promise<PracticeWithDetails> => {
  // Get organization from Better Auth
  const organization = await getFullOrganization(
    organizationId,
    user,
    fastify,
    requestHeaders,
  );

  if (!organization) {
    throw fastify.httpErrors.notFound('Practice not found');
  }

  // Get optional practice details
  const practiceDetails =
    await findPracticeDetailsByOrganization(organizationId);

  // Clean practice details (remove internal fields only)
  const cleanPracticeDetails = practiceDetails
    ? omit(practiceDetails, [
        'id',
        'organizationId',
        'userId',
        'createdAt',
        'updatedAt',
      ])
    : null;

  return {
    ...organization,
    ...cleanPracticeDetails,
    practice_details: cleanPracticeDetails,
  };
};

export const createPracticeService = async (
  data: PracticeCreateRequest,
  user: User,
  fastify: FastifyInstance,
  requestHeaders: Record<string, string>,
): Promise<PracticeWithDetails> => {
  try {
    fastify.log.info(
      {
        context: {
          service: 'PracticeService',
          operation: 'createPractice',
          userId: user.id,
          userEmail: user.email,
          practiceData: {
            name: data.name,
            slug: data.slug,
            hasBusinessPhone: !!data.business_phone,
            hasBusinessEmail: !!data.business_email,
          },
        },
      },
      'Creating new practice',
    );

    // Extract practice details (optional fields)
    const {
      business_phone,
      business_email,
      consultation_fee,
      payment_url,
      calendly_url,
      ...organizationData
    } = data;

    // Create organization in Better Auth (all validation comes from Better Auth org plugin)
    const organization = await createOrganization(
      organizationData,
      user,
      fastify,
      requestHeaders,
    );

    if (!organization) {
      throw fastify.httpErrors.internalServerError(
        'Failed to create organization',
      );
    }

    // Create optional practice details if provided
    let practiceDetails = null;
    if (
      business_phone ||
      business_email ||
      consultation_fee ||
      payment_url ||
      calendly_url
    ) {
      practiceDetails = await createPracticeDetails({
        organization_id: organization.id,
        user_id: user.id,
        business_phone,
        business_email,
        consultation_fee,
        payment_url,
        calendly_url,
      });

      // Publish practice details created event
      await publishEvent({
        eventType: EventType.PRACTICE_DETAILS_CREATED,
        actorId: user.id,
        organizationId: organization.id,
        data: {
          practiceDetailsId: practiceDetails.id,
          businessPhone: business_phone,
          businessEmail: business_email,
          consultationFee: consultation_fee,
          paymentUrl: payment_url,
          calendlyUrl: calendly_url,
        },
        headers: requestHeaders,
      });
    }

    // Publish practice created event (organization + optional details)
    await publishEvent({
      eventType: EventType.PRACTICE_CREATED,
      actorId: user.id,
      organizationId: organization.id,
      data: {
        organizationName: organization.name,
        organizationSlug: organization.slug,
        hasPracticeDetails: !!practiceDetails,
        practiceDetailsId: practiceDetails?.id,
        userEmail: user.email,
      },
      headers: requestHeaders,
    });

    // Clean practice details (remove internal fields only)
    const cleanPracticeDetails = practiceDetails
      ? omit(practiceDetails, [
          'id',
          'organizationId',
          'userId',
          'createdAt',
          'updatedAt',
        ])
      : null;

    return {
      ...organization,
      ...cleanPracticeDetails,
      practice_details: cleanPracticeDetails,
    };
  } catch (error) {
    // Add business context for debugging
    fastify.log.error(
      {
        error: sanitizeError(error),
        context: {
          service: 'PracticeService',
          operation: 'createPractice',
          userId: user.id,
          userEmail: user.email,
          practiceData: {
            name: data.name,
            slug: data.slug,
          },
        },
      },
      'Failed to create practice',
    );

    throw error; // Re-throw so global handler also logs it
  }
};

export const updatePracticeService = async (
  organizationId: string,
  data: PracticeUpdateRequest,
  user: User,
  fastify: FastifyInstance,
  requestHeaders: Record<string, string>,
): Promise<PracticeWithDetails | null> => {
  // Extract practice details (optional fields)
  const {
    business_phone,
    business_email,
    consultation_fee,
    payment_url,
    calendly_url,
    ...organizationData
  } = data;

  // Update organization in Better Auth only if there are organization fields to update
  let organization = null;
  if (Object.keys(organizationData).length > 0) {
    organization = await updateOrganization(
      organizationId,
      organizationData as UpdateOrganizationRequest,
      user,
      fastify,
      requestHeaders,
    );

    if (!organization) {
      return null;
    }
  } else {
    // If no organization data to update, fetch the current organization
    const orgResults = await fastify.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    organization = orgResults[0] || null;
    if (!organization) {
      return null;
    }
  }

  // Update optional practice details if provided
  let practiceDetails = null;
  if (
    business_phone ||
    business_email ||
    consultation_fee ||
    payment_url ||
    calendly_url
  ) {
    const practiceData = {
      business_phone,
      business_email,
      consultation_fee,
      payment_url,
      calendly_url,
    };
    practiceDetails = await upsertPracticeDetails(
      organizationId,
      user.id,
      practiceData,
    );

    // Publish practice details updated event
    await publishEvent({
      eventType: EventType.PRACTICE_DETAILS_UPDATED,
      actorId: user.id,
      organizationId,
      data: practiceData,
      headers: requestHeaders,
    });
  }

  // Publish practice updated event
  await publishEvent({
    eventType: EventType.PRACTICE_UPDATED,
    actorId: user.id,
    organizationId,
    data: {
      organizationName: organization?.name || 'Unknown',
      organizationSlug: organization?.slug || 'unknown',
      hasPracticeDetails: !!practiceDetails,
      practiceDetailsId: practiceDetails?.id,
      userEmail: user.email,
    },
    headers: requestHeaders,
  });

  // Clean practice details (remove internal fields only)
  const cleanPracticeDetails = practiceDetails
    ? omit(practiceDetails, [
        'id',
        'organization_id',
        'user_id',
        'created_at',
        'updated_at',
      ])
    : null;

  return {
    ...organization,
    ...cleanPracticeDetails,
    practice_details: cleanPracticeDetails,
  };
};

export const deletePracticeService = async (
  organizationId: string,
  user: User,
  fastify: FastifyInstance,
  requestHeaders: Record<string, string>,
): Promise<{ success: boolean }> => {
  // Get practice details before deletion for event payload
  const existingPracticeDetails =
    await findPracticeDetailsByOrganization(organizationId);

  // Delete optional practice details first
  await deletePracticeDetails(fastify.db, organizationId);

  // Publish practice details deleted event if they existed
  if (existingPracticeDetails) {
    await publishEvent({
      eventType: EventType.PRACTICE_DETAILS_DELETED,
      actorId: user.id,
      organizationId,
      data: {
        practiceDetailsId: existingPracticeDetails.id,
        business_phone: existingPracticeDetails.business_phone,
        business_email: existingPracticeDetails.business_email,
        consultation_fee: existingPracticeDetails.consultation_fee,
        payment_url: existingPracticeDetails.payment_url,
        calendly_url: existingPracticeDetails.calendly_url,
      },
      headers: requestHeaders,
    });
  }

  // Delete organization in Better Auth
  await deleteOrganization(organizationId, user, fastify, requestHeaders);

  // Publish practice deleted event
  await publishEvent({
    eventType: EventType.PRACTICE_DELETED,
    actorId: user.id,
    organizationId,
    data: {
      hadPracticeDetails: !!existingPracticeDetails,
      practiceDetailsId: existingPracticeDetails?.id,
      userEmail: user.email,
    },
    headers: requestHeaders,
  });

  return { success: true };
};

export const setActivePractice = async (
  organizationId: string,
  user: User,
  fastify: FastifyInstance,
  requestHeaders: Record<string, string>,
): Promise<{ success: boolean }> => {
  // Forward to Better Auth org plugin
  await setActiveOrganization(organizationId, user, fastify, requestHeaders);
  return { success: true };
};
