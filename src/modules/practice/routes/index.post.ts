import { FastifyRequest, FastifyReply } from 'fastify';
import { createPracticeService } from '@/modules/practice/services/practice.service';
import { createPracticeSchema } from '@/modules/practice/validations/practice.validation';
import { validateBody } from '@/shared/lib/validate';

type CreatePracticeRequest = {
  Body: unknown; // Will be validated by Zod
};

/**
 * Create a new practice (organization + optional practice details)
 * POST /api/practice
 *
 * All organization validation comes from Better Auth org plugin
 * Practice details are optional and stored separately
 */
const createPracticeRoute = async (
  request: FastifyRequest<CreatePracticeRequest>,
  reply: FastifyReply,
): Promise<FastifyReply> => {
  const validatedData = await validateBody(
    request,
    reply,
    createPracticeSchema,
  );

  const practice = await createPracticeService(
    validatedData,
    request.user,
    request.server,
    request.headers as Record<string, string>,
  );
  return reply.status(201).send({ practice });
};

export default createPracticeRoute;
