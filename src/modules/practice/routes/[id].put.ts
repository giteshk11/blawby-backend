import { FastifyRequest, FastifyReply } from 'fastify';
import { updatePracticeService } from '../services/practice.service';
import { updatePracticeSchema } from '../schemas/practice.schema';
import { validateBody } from '@/shared/utils/validation';

type UpdatePracticeRequest = {
  Params: {
    id: string;
  };
  Body: unknown; // Will be validated by Zod
};

/**
 * Update practice by ID (organization + optional practice details)
 * PUT /api/practice/:id
 */
export default async function updatePractice(
  request: FastifyRequest<UpdatePracticeRequest>,
  reply: FastifyReply,
) {
  const validatedData = await validateBody(
    request,
    reply,
    updatePracticeSchema,
  );

  const practice = await updatePracticeService(
    request.params.id,
    validatedData,
    request.user,
    request.server,
    request.headers as Record<string, string>,
  );
  return reply.send({ practice });
}
