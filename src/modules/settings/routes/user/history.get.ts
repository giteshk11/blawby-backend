import { FastifyRequest, FastifyReply } from 'fastify';
import { getSettingsHistory } from '@/modules/settings/services/settings.service';

type GetUserSettingsHistoryRequest = {
  query: {
    limit?: number;
  };
};

/**
 * Get user settings history
 * GET /api/settings/user/history
 */
const getUserSettingsHistoryRoute = async (
  request: FastifyRequest<GetUserSettingsHistoryRequest>,
  reply: FastifyReply,
): Promise<FastifyReply> => {
  const { limit = 50 } = request.query;
  const history = await getSettingsHistory('user', request.userId ?? '', limit);

  return reply.send({ data: history });
};

export default getUserSettingsHistoryRoute;
