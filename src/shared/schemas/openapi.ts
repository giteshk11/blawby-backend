import { z } from '@hono/zod-openapi';

export const ErrorSchema = z
  .object({
    error: z.string(),
    message: z.string().optional(),
    requestId: z.string().optional(),
  })
  .openapi('Error');

export const ValidationErrorSchema = z
  .object({
    error: z.string(),
    message: z.string(),
    validation: z.array(
      z.object({
        field: z.string(),
        message: z.string(),
        code: z.string(),
      }),
    ),
  })
  .openapi('ValidationError');

export const UnauthorizedSchema = z
  .object({
    error: z.literal('Unauthorized'),
    message: z.string().optional(),
  })
  .openapi('Unauthorized');

export const NotFoundSchema = z
  .object({
    error: z.literal('Not Found'),
    message: z.string().optional(),
  })
  .openapi('NotFound');
