import { FastifyRequest, FastifyReply } from 'fastify';
import { getOrganizationSettings } from '../../services/settings.service';

type GetOrganizationSettingsRequest = {
  Params: {
    organizationId: string;
  };
};

/**
 * Get organization settings
 * GET /api/settings/organization/:organizationId
 */
const getOrganizationSettingsRoute = async (
  request: FastifyRequest<GetOrganizationSettingsRequest>,
  reply: FastifyReply,
): Promise<FastifyReply> => {
  const { organizationId } = request.params;

  // Check if user has permission to access this organization
  if (request.activeOrganizationId !== organizationId) {
    return reply.forbidden('Access denied to organization settings');
  }

  const settings = await getOrganizationSettings(organizationId);
  return reply.send({ data: settings });
};

export default getOrganizationSettingsRoute;
