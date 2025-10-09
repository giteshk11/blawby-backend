import { FastifyRequest, FastifyReply } from 'fastify';
import { updateOrganizationSettingsCategory } from '@/modules/settings/services/settings.service';
import { z } from 'zod';

type UpdateOrganizationSettingsCategoryRequest = {
  Params: {
    organizationId: string;
    category: string;
  };
  Body: any;
};

/**
 * Update specific organization settings category
 * PUT /api/settings/organization/:organizationId/:category
 */
export default async function updateOrganizationSettingsCategoryRoute(
  request: FastifyRequest<UpdateOrganizationSettingsCategoryRequest>,
  reply: FastifyReply,
) {
  const { organizationId, category } = request.params;

  // Check if user has permission to access this organization
  if (request.activeOrganizationId !== organizationId) {
    return reply.forbidden('Access denied to organization settings');
  }

  const settings = await updateOrganizationSettingsCategory(
    organizationId,
    category,
    request.body,
    request.userId, // changedBy
  );

  return reply.send({ data: settings });
}

export const config = {
  
};
