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

export async function validateQuery<T extends z.ZodType>(
  request: FastifyRequest,
  reply: FastifyReply,
  schema: T,
): Promise<z.infer<T>> {
  try {
    const result = schema.parse(request.query);
    return result;
  } catch (error) {
    if (error instanceof ZodError) {
      request.log.info({
        msg: 'Query validation failed',
        errors: error.issues,
        query: request.query,
      });

      const validationErrors = error.issues.map((issue) => ({
        field: issue.path.join('.') || 'query',
        message: issue.message,
        code: issue.code,
      }));

      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Query validation failed',
        validation: validationErrors,
      });
    }
    throw error;
  }
}

export async function validateParams<T extends z.ZodType>(
  request: FastifyRequest,
  reply: FastifyReply,
  schema: T,
): Promise<z.infer<T>> {
  try {
    const result = schema.parse(request.params);
    return result;
  } catch (error) {
    if (error instanceof ZodError) {
      request.log.info({
        msg: 'Params validation failed',
        errors: error.issues,
        params: request.params,
      });

      const validationErrors = error.issues.map((issue) => ({
        field: issue.path.join('.') || 'params',
        message: issue.message,
        code: issue.code,
      }));

      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Params validation failed',
        validation: validationErrors,
      });
    }
    throw error;
  }
}
