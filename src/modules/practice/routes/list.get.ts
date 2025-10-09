import { FastifyRequest, FastifyReply } from 'fastify';
import { listPractices } from '../services/practice.service';

/**
 * List all practices (organizations) for the user
 * GET /api/practice/list
 */
export default async function listPracticesRoute(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const practices = await listPractices(
    request.user,
    request.server,
    request.headers as Record<string, string>,
  );
  return reply.send({ practices });
}
