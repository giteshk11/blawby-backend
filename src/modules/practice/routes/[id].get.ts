import { FastifyRequest, FastifyReply } from 'fastify';
import { getPracticeById } from '../services/practice.service';

type GetPracticeRequest = {
  Params: {
    id: string;
  };
};

/**
 * Get practice by ID (organization + optional practice details)
 * GET /api/practice/:id
 */
export default async function getPractice(
  request: FastifyRequest<GetPracticeRequest>,
  reply: FastifyReply,
) {
  const practice = await getPracticeById(
    request.params.id,
    request.user,
    request.server,
    request.headers as Record<string, string>,
  );
  return reply.send({ practice });
}
