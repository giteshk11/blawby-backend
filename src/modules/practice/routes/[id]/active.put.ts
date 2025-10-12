import { FastifyRequest, FastifyReply } from 'fastify';
import { setActivePractice } from '../../services/practice.service';

type SetActivePracticeRequest = {
  Params: {
    id: string;
  };
};

/**
 * Set active practice (organization)
 * PUT /api/practice/:id/active
 */
export default async function setActivePracticeRoute(
  request: FastifyRequest<SetActivePracticeRequest>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const result = await setActivePractice(
    request.params.id,
    request.user,
    request.server,
    request.headers as Record<string, string>,
  );
  return reply.send({ result });
}
