import { FastifyRequest, FastifyReply } from 'fastify';
import { getUserSettings } from '../services/settings.service';

/**
 * Get user settings
 * GET /api/settings/user
 */
const getUserSettingsRoute = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> => {
  if (!request.userId) {
    return reply.badRequest('User ID is required');
  }
  const settings = await getUserSettings(request.userId);
  return reply.send({ data: settings });
};

export default getUserSettingsRoute;
