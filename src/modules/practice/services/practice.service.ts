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
  console.log(
    '🔍 createPracticeService called with data:',
    JSON.stringify(data, null, 2),
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
  }

  return {
    ...organization,
    practiceDetails,
  };
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
  }

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
  // Delete optional practice details first
  await deletePracticeDetails(organizationId);

  // Delete organization in Better Auth
  return deleteOrganization(organizationId, user, fastify, requestHeaders);
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
