import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * Raw Body Plugin
 *
 * Adds raw body support for specific routes (like Stripe webhooks)
 * This allows signature verification while still parsing JSON for other routes
 */
export default fp(async function rawBodyPlugin(fastify: FastifyInstance) {
  // Add a content type parser that keeps the raw body
  // This will be used for routes that need raw body (configured via route config)
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    async (request: FastifyRequest, payload: Buffer) => {
      // Store raw body for signature verification
      request.rawBody = payload;

      // Parse JSON for normal use
      const body = JSON.parse(payload.toString('utf8'));
      return body;
    },
  );

  fastify.log.info('✅ Raw body plugin registered');
});
