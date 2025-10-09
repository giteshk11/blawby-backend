import { ZodError, type z } from 'zod';
import type { FastifyRequest, FastifyReply } from 'fastify';

export async function validateBody<T extends z.ZodType>(
  request: FastifyRequest,
  reply: FastifyReply,
  schema: T,
): Promise<z.infer<T>> {
  try {
    const result = schema.parse(request.body);
    return result;
  } catch (error) {
    if (error instanceof ZodError) {
      request.log.info({
        msg: 'Validation failed',
        errors: error.issues,
        body: request.body,
      });

      // Build structured error response for frontend
      const validationErrors = error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
        code: issue.code,
      }));

      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        validation: validationErrors,
      });
    }
    throw error;
  }
}
