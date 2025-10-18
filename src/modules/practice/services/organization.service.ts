import type { FastifyInstance } from 'fastify';
import type {
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  OrganizationListItem,
} from '@/modules/practice/types/practice.types';
import { eq } from 'drizzle-orm';
import {
  organizations as organizationTable,
  members as memberTable,
} from '@/schema';
import { EventType } from '@/shared/events/enums/event-types';
import { publishEvent } from '@/shared/events/dispatcher';
import type {
  Organization,
  User,
  ActiveOrganization,
} from '@/shared/types/better-auth';

export const createOrganization = async (
  data: CreateOrganizationRequest,
  user: User,
  fastify: FastifyInstance,
  requestHeaders: Record<string, string>,
): Promise<Organization | null> => {
  if (!data.name) {
    throw fastify.httpErrors.badRequest('Organization name is required');
  }

  if (!data.slug) {
    throw fastify.httpErrors.badRequest('Organization slug is required');
  }

  // Check if slug is available
  const slugCheck = await fastify.betterAuth.api.checkOrganizationSlug({
    body: { slug: data.slug },
  });

  if (!slugCheck.status) {
    throw fastify.httpErrors.conflict(
      `Organization slug '${data.slug}' is already taken`,
    );
  }

  const result = await fastify.betterAuth.api.createOrganization({
    body: data,
    headers: requestHeaders,
  });

  // Publish practice created event
  await publishEvent({
    eventType: EventType.PRACTICE_CREATED,
    actorId: user.id,
    organizationId: result?.id || 'unknown',
    data: {
      organizationName: result?.name || 'Unknown',
      organizationSlug: result?.slug || 'unknown',
      role: 'owner',
      userEmail: user.email,
    },
    headers: requestHeaders,
  });

  return result;
};

export const listOrganizations = async (
  user: User,
  fastify: FastifyInstance,
  _requestHeaders: Record<string, string>,
): Promise<OrganizationListItem[]> => {
  // Query organizations directly from database
  const organizations = await fastify.db
    .select({
      id: organizationTable.id,
      name: organizationTable.name,
      slug: organizationTable.slug,
      logo: organizationTable.logo,
      createdAt: organizationTable.createdAt,
      metadata: organizationTable.metadata,
      role: memberTable.role,
    })
    .from(organizationTable)
    .innerJoin(
      memberTable,
      eq(organizationTable.id, memberTable.organizationId),
    )
    .where(eq(memberTable.userId, user.id));

  return organizations;
};

export const getFullOrganization = async (
  organizationId: string,
  user: User,
  fastify: FastifyInstance,
  requestHeaders: Record<string, string>,
): Promise<ActiveOrganization> => {
  const result = await fastify.betterAuth.api.getFullOrganization({
    query: { organizationId },
    headers: requestHeaders,
  });
  return result;
};

export const updateOrganization = async (
  organizationId: string,
  data: UpdateOrganizationRequest,
  user: User,
  fastify: FastifyInstance,
  requestHeaders: Record<string, string>,
): Promise<Organization | null> => {
  const result = await fastify.betterAuth.api.updateOrganization({
    body: {
      organizationId,
      data,
    },
    headers: requestHeaders,
  });

  // Publish practice updated event
  await publishEvent({
    eventType: EventType.PRACTICE_UPDATED,
    actorId: user.id,
    organizationId,
    data: {
      organizationName: result?.name || 'Unknown',
      organizationSlug: result?.slug || 'unknown',
      updatedFields: Object.keys(data),
      userEmail: user.email,
    },
    headers: requestHeaders,
  });

  return result;
};

export const deleteOrganization = async (
  organizationId: string,
  user: User,
  fastify: FastifyInstance,
  requestHeaders: Record<string, string>,
): Promise<Organization | null> => {
  const result = await fastify.betterAuth.api.deleteOrganization({
    body: { organizationId },
    headers: requestHeaders,
  });

  // Publish practice deleted event
  await publishEvent({
    eventType: EventType.PRACTICE_DELETED,
    actorId: user.id,
    organizationId,
    data: {
      userEmail: user.email,
    },
    headers: requestHeaders,
  });

  return result;
};

export const setActiveOrganization = async (
  organizationId: string,
  user: User,
  fastify: FastifyInstance,
  requestHeaders: Record<string, string>,
): Promise<ActiveOrganization | null> => {
  const result = await fastify.betterAuth.api.setActiveOrganization({
    body: { organizationId },
    headers: requestHeaders,
  });

  // Publish practice switched event
  await publishEvent({
    eventType: EventType.PRACTICE_SWITCHED,
    actorId: user.id,
    organizationId,
    data: {
      userEmail: user.email,
    },
    headers: requestHeaders,
  });

  return result;
};

export const checkOrganizationSlug = async (
  slug: string,
  fastify: FastifyInstance,
): Promise<boolean> => {
  const result = await fastify.betterAuth.api.checkOrganizationSlug({
    body: { slug },
  });
  return result.status;
};
