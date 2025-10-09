import { FastifyRequest, FastifyReply } from 'fastify';
import { getUserSettings } from '../services/settings.service';

/**
 * Get user settings
 * GET /api/settings/user
 */
export default async function getUserSettingsRoute(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const settings = await getUserSettings(request.userId);
  return reply.send({ data: settings });
}

export const config = {
  
};
