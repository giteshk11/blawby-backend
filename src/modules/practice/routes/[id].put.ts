import { FastifyRequest, FastifyReply } from 'fastify';
import { updatePracticeService } from '@/modules/practice/services/practice.service';
import { updatePracticeSchema } from '@/modules/practice/validations/practice.validation';
import { validateBody } from '@/shared/lib/validate';

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
const updatePractice = async (
  request: FastifyRequest<UpdatePracticeRequest>,
  reply: FastifyReply,
): Promise<FastifyReply> => {
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
};

export default updatePractice;
