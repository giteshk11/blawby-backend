/**
 * Global Error Handler Plugin
 * Catches all unhandled errors and logs them with full context
 */
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  sanitizeError,
  sanitizeHeaders,
  sanitizeBody,
  categorizeError,
} from '@/shared/utils/logging';

declare module 'fastify' {
  interface FastifyInstance {
    logError: (
      error: unknown,
      request: FastifyRequest,
      context?: Record<string, unknown>,
    ) => void;
  }
}

export default fp(async function errorHandlerPlugin(fastify: FastifyInstance) {
  // Add helper method to Fastify instance
  fastify.decorate(
    'logError',
    function logError(
      error: unknown,
      request: FastifyRequest,
      context: Record<string, unknown> = {},
    ): void {
      const sanitizedError = sanitizeError(error);
      const errorType = categorizeError(sanitizedError);

      fastify.log.error(
        {
          reqId: request.id,
          errorType,
          error: sanitizedError,
          request: {
            method: request.method,
            url: request.url,
            headers: sanitizeHeaders(request.headers),
            body: sanitizeBody(request.body),
            query: request.query,
            params: request.params,
          },
          user: {
            userId: request.userId,
            organizationId: request.activeOrganizationId,
            sessionId: request.session?.id,
          },
          context,
          timestamp: new Date().toISOString(),
        },
        `Global error handler caught ${errorType} error`,
      );
    },
  );

  // Global error handler hook
  fastify.addHook(
    'onError',
    async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
      const sanitizedError = sanitizeError(error);
      const errorType = categorizeError(sanitizedError);

      // Log the error with full context
      fastify.logError(error, request, {
        hook: 'onError',
        errorType,
      });

      // Determine appropriate response based on error type and environment
      const isDevelopment = process.env.NODE_ENV !== 'production';

      let statusCode = 500;
      let message = 'Internal Server Error';

      switch (errorType) {
        case 'authentication':
          statusCode = 401;
          message = 'Authentication failed';
          break;
        case 'validation':
          statusCode = 400;
          message = 'Validation failed';
          break;
        case 'notfound':
          statusCode = 404;
          message = 'Not found';
          break;
        case 'database':
          statusCode = 500;
          message = 'Database error';
          break;
        case 'http':
          statusCode =
            typeof sanitizedError.statusCode === 'number'
              ? sanitizedError.statusCode
              : 500;
          message =
            typeof sanitizedError.message === 'string'
              ? sanitizedError.message
              : 'HTTP error';
          break;
        default:
          statusCode = 500;
          message = 'Internal Server Error';
      }

      // Prepare error response
      const errorResponse: Record<string, unknown> = {
        statusCode,
        error: message,
        message: isDevelopment ? sanitizedError.message : message,
      };

      // Include additional details in development
      if (isDevelopment) {
        errorResponse.details = {
          name: sanitizedError.name,
          stack: sanitizedError.stack,
          cause: sanitizedError.cause,
        };
      }

      // Include request ID for tracing
      errorResponse.requestId = request.id;

      // Send error response
      reply.status(statusCode).send(errorResponse);
    },
  );

  fastify.log.info('✅ Global error handler plugin registered');
});
