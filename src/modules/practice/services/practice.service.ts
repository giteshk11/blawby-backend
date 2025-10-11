import {
  createOrganization,
  listOrganizations,
  getFullOrganization,
  updateOrganization,
  deleteOrganization,
  setActiveOrganization,
} from './organization.service';
import {
  createPracticeDetails,
  findPracticeDetailsByOrganization,
  updatePracticeDetails,
  deletePracticeDetails,
} from '../repositories/practice-details.repository';
import {
  InsertPracticeRequest,
  UpdatePracticeRequest,
} from '../schemas/practice.schema';
import type { FastifyInstance } from 'fastify';
import { EventType } from '@/shared/events/enums/event-types';
import { publishEvent } from '@/shared/events/dispatcher';
import { sanitizeError } from '@/shared/utils/logging';

type User = {
  id: string;
  email: string;
};

// Practice service functions (practice = organization + optional practice details)
export const listPractices = async (
  user: User,
  fastify: FastifyInstance,
  requestHeaders: Record<string, string>,
) => {
  // Forward to Better Auth org plugin
  return listOrganizations(user, fastify, requestHeaders);
};

export const getPracticeById = async (
  organizationId: string,
  user: User,
  fastify: FastifyInstance,
  requestHeaders: Record<string, string>,
) => {
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

  return {
    ...organization,
    practiceDetails,
  };
};

export const createPracticeService = async (
  data: InsertPracticeRequest,
  user: User,
  fastify: FastifyInstance,
  requestHeaders: Record<string, string>,
) => {
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
            hasBusinessPhone: !!data.businessPhone,
            hasBusinessEmail: !!data.businessEmail,
          },
        },
      },
      'Creating new practice',
    );

    // Extract practice details (optional fields)
    const {
      businessPhone,
      businessEmail,
      consultationFee,
      paymentUrl,
      calendlyUrl,
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
      businessPhone ||
      businessEmail ||
      consultationFee ||
      paymentUrl ||
      calendlyUrl
    ) {
      practiceDetails = await createPracticeDetails({
        organizationId: organization.id,
        businessPhone,
        businessEmail,
        consultationFee,
        paymentUrl,
        calendlyUrl,
        userId: user.id,
      });

      // Publish practice details created event
      await publishEvent({
        fastify,
        eventType: EventType.PRACTICE_DETAILS_CREATED,
        actorId: user.id,
        organizationId: organization.id,
        data: {
          practiceDetailsId: practiceDetails.id,
          businessPhone,
          businessEmail,
          consultationFee,
          paymentUrl,
          calendlyUrl,
        },
        headers: requestHeaders,
      });
    }

    // Publish practice created event (organization + optional details)
    await publishEvent({
      fastify,
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

    return {
      ...organization,
      practiceDetails,
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
  data: UpdatePracticeRequest,
  user: User,
  fastify: FastifyInstance,
  requestHeaders: Record<string, string>,
) => {
  // Extract practice details (optional fields)
  const {
    businessPhone,
    businessEmail,
    consultationFee,
    paymentUrl,
    calendlyUrl,
    ...organizationData
  } = data;

  // Update organization in Better Auth
  const organization = await updateOrganization(
    organizationId,
    organizationData,
    user,
    fastify,
    requestHeaders,
  );

  // Update optional practice details if provided
  let practiceDetails = null;
  if (
    businessPhone ||
    businessEmail ||
    consultationFee ||
    paymentUrl ||
    calendlyUrl
  ) {
    practiceDetails = await updatePracticeDetails(organizationId, {
      businessPhone,
      businessEmail,
      consultationFee,
      paymentUrl,
      calendlyUrl,
    });

    // Publish practice details updated event
    await publishEvent({
      fastify,
      eventType: EventType.PRACTICE_DETAILS_UPDATED,
      actorId: user.id,
      organizationId,
      data: {
        practiceDetailsId: practiceDetails?.id,
        businessPhone,
        businessEmail,
        consultationFee,
        paymentUrl,
        calendlyUrl,
      },
      headers: requestHeaders,
    });
  }

  // Publish practice updated event
  await publishEvent({
    fastify,
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

  return {
    ...organization,
    practiceDetails,
  };
};

export const deletePracticeService = async (
  organizationId: string,
  user: User,
  fastify: FastifyInstance,
  requestHeaders: Record<string, string>,
) => {
  // Get practice details before deletion for event payload
  const existingPracticeDetails =
    await findPracticeDetailsByOrganization(organizationId);

  // Delete optional practice details first
  await deletePracticeDetails(organizationId);

  // Publish practice details deleted event if they existed
  if (existingPracticeDetails) {
    await publishEvent({
      fastify,
      eventType: EventType.PRACTICE_DETAILS_DELETED,
      actorId: user.id,
      organizationId,
      data: {
        practiceDetailsId: existingPracticeDetails.id,
        businessPhone: existingPracticeDetails.businessPhone,
        businessEmail: existingPracticeDetails.businessEmail,
        consultationFee: existingPracticeDetails.consultationFee,
        paymentUrl: existingPracticeDetails.paymentUrl,
        calendlyUrl: existingPracticeDetails.calendlyUrl,
      },
      headers: requestHeaders,
    });
  }

  // Delete organization in Better Auth
  const result = await deleteOrganization(
    organizationId,
    user,
    fastify,
    requestHeaders,
  );

  // Publish practice deleted event
  await publishEvent({
    fastify,
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

  return result;
};

export const setActivePractice = async (
  organizationId: string,
  user: User,
  fastify: FastifyInstance,
  requestHeaders: Record<string, string>,
) => {
  // Forward to Better Auth org plugin
  return setActiveOrganization(organizationId, user, fastify, requestHeaders);
};
