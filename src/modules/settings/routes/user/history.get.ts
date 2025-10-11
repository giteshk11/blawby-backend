import { FastifyRequest, FastifyReply } from 'fastify';
import { getSettingsHistory } from '@/modules/settings/services/settings.service';
import { z } from 'zod';

type GetUserSettingsHistoryRequest = {
  query: {
    limit?: number;
  };
};

/**
 * Get user settings history
 * GET /api/settings/user/history
 */
export default async function getUserSettingsHistoryRoute(
  request: FastifyRequest<GetUserSettingsHistoryRequest>,
  reply: FastifyReply,
) {
  const { limit = 50 } = request.query;
  const history = await getSettingsHistory('user', request.userId ?? '', limit);

  return reply.send({ data: history });
}

export const config = {};
