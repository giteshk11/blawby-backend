import { FastifyRequest, FastifyReply } from 'fastify';
import { deletePracticeService } from '../services/practice.service';

type DeletePracticeRequest = {
  Params: {
    id: string;
  };
};

/**
 * Delete practice by ID (organization + practice details)
 * DELETE /api/practice/:id
 */
export default async function deletePractice(
  request: FastifyRequest<DeletePracticeRequest>,
  reply: FastifyReply,
) {
  await deletePracticeService(
    request.params.id,
    request.user,
    request.server,
    request.headers as Record<string, string>,
  );
  return reply.status(204).send();
}
