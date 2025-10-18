import { FastifyRequest, FastifyReply } from 'fastify';
import { listPractices } from '@/modules/practice/services/practice.service';

/**
 * List all practices (organizations) for the user
 * GET /api/practice/list
 */
const listPracticesRoute = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> => {
  const practices = await listPractices(
    request.user,
    request.server,
    request.headers as Record<string, string>,
  );
  return reply.send({ practices });
};

export default listPracticesRoute;
