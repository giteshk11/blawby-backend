import { FastifyRequest, FastifyReply } from 'fastify';
import { createPracticeService } from '../services/practice.service';
import { insertPracticeSchema } from '../schemas/practice.schema';
import { validateBody } from '@/shared/utils/validation';

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
export default async function createPractice(
  request: FastifyRequest<CreatePracticeRequest>,
  reply: FastifyReply,
) {
  const validatedData = await validateBody(
    request,
    reply,
    insertPracticeSchema,
  );

  const practice = await createPracticeService(
    validatedData,
    request.user,
    request.server,
    request.headers as Record<string, string>,
  );
  return reply.status(201).send({ practice });
}
