import { FastifyRequest, FastifyReply } from 'fastify';
import { getPracticeById } from '@/modules/practice/services/practice.service';
import type { User } from '@/schema';

type GetPracticeRequest = {
  Params: {
    id: string;
  };
};

/**
 * Get practice by ID (organization + optional practice details)
 * GET /api/practice/:id
 */
const getPractice = async (
  request: FastifyRequest<GetPracticeRequest>,
  reply: FastifyReply,
): Promise<FastifyReply> => {
  const practice = await getPracticeById(
    request.params.id,
    request.user! as Pick<User, 'id' | 'email'>,
    request.server,
    request.headers as Record<string, string>,
  );
  return reply.send({ practice });
};

export default getPractice;
