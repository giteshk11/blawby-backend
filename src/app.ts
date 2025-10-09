import { FastifyInstance } from 'fastify';
import fileRouterPlugin from './shared/router/file-router';

// Core plugins
import dbPlugin from './shared/database/client';
import betterAuthPlugin from './shared/auth/better-auth';
import authCore from './shared/auth/verify-auth';

// Infrastructure plugins
import sensiblePlugin from './shared/middleware/sensible';
import corsPlugin from './shared/middleware/cors';
import helmetPlugin from './shared/middleware/helmet';
import rateLimitPlugin from './shared/middleware/rate-limit';

/**
 * Application setup
 * Registers all plugins and file-based routes
 */
export default async function app(fastify: FastifyInstance) {
  // 1. Infrastructure (order matters!)
  await fastify.register(sensiblePlugin);
  await fastify.register(corsPlugin);
  await fastify.register(helmetPlugin);
  await fastify.register(rateLimitPlugin);

  // 2. Core services
  await fastify.register(dbPlugin);
  await fastify.register(betterAuthPlugin);
  await fastify.register(authCore);

  // 3. File-based routes (auto-discovery)
  await fastify.register(fileRouterPlugin);

  fastify.log.info('✅ Application setup complete');
}
