import { FastifyRequest, FastifyReply } from 'fastify';
import { updateOrganizationSettings } from '@/modules/settings/services/settings.service';
import { validateBody } from '@/shared/lib/validate';
import { updateOrganizationSettingsSchema } from '@/shared/validations/settings';

type UpdateOrganizationSettingsRequest = {
  Params: {
    organizationId: string;
  };
  Body: unknown; // Will be validated by Zod
};

/**
 * Update organization settings
 * PUT /api/settings/organization/:organizationId
 */
const updateOrganizationSettingsRoute = async (
  request: FastifyRequest<UpdateOrganizationSettingsRequest>,
  reply: FastifyReply,
): Promise<FastifyReply> => {
  const { organizationId } = request.params;
  const validatedData = await validateBody(
    request,
    reply,
    updateOrganizationSettingsSchema,
  );

  // Check if user has permission to access this organization
  if (request.activeOrganizationId !== organizationId) {
    return reply.forbidden('Access denied to organization settings');
  }

  const settings = await updateOrganizationSettings(
    organizationId,
    validatedData,
    request.userId!, // changedBy
    request.server, // fastify instance for events
  );

  return reply.send({ data: settings });
};

export default updateOrganizationSettingsRoute;
