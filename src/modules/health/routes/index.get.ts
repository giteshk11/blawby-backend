import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Health check endpoint
 * GET /api/health
 */
export default async function healthCheck(
  _request: FastifyRequest,
  _reply: FastifyReply,
) {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
}

// No auth required for health check
export const config = {};
