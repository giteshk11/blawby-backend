/**
 * Request/Response Logger Plugin
 * Logs all incoming requests and outgoing responses with timing
 */
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  sanitizeHeaders,
  sanitizeBody,
  shouldSkipLogging,
  formatResponseTime,
} from '@/shared/utils/logging';

export default fp(async function requestLoggerPlugin(fastify: FastifyInstance) {
  // Track request start time
  fastify.addHook(
    'onRequest',
    async (request: FastifyRequest, _reply: FastifyReply) => {
      // Skip logging for certain endpoints
      if (shouldSkipLogging(request.url, request.method)) {
        return;
      }

      // Store start time for response timing
      request.startTime = Date.now();

      // Log incoming request
      fastify.log.info(
        {
          reqId: request.id,
          method: request.method,
          url: request.url,
          headers: sanitizeHeaders(request.headers),
          query: request.query,
          params: request.params,
          body: sanitizeBody(request.body),
          userAgent: request.headers['user-agent'],
          ip: request.ip,
          timestamp: new Date().toISOString(),
        },
        'Incoming request',
      );
    },
  );

  // Log outgoing response
  fastify.addHook(
    'onResponse',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip logging for certain endpoints
      if (shouldSkipLogging(request.url, request.method)) {
        return;
      }

      const startTime = request.startTime;
      const responseTime = startTime ? Date.now() - startTime : 0;

      // Determine log level based on status code
      const logLevel = reply.statusCode >= 400 ? 'error' : 'info';

      // Log response
      fastify.log[logLevel](
        {
          reqId: request.id,
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          responseTime: responseTime,
          responseTimeFormatted: formatResponseTime(responseTime),
          user: {
            userId: request.userId,
            organizationId: request.activeOrganizationId,
          },
          timestamp: new Date().toISOString(),
        },
        `Response sent - ${reply.statusCode}`,
      );
    },
  );

  fastify.log.info('✅ Request/Response logger plugin registered');
});
