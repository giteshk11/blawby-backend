import { FastifyInstance } from 'fastify';
import fileRouterPlugin from './shared/router/file-router';

// Core plugins
import dbPlugin from './shared/database/client';
import betterAuthPlugin from './shared/auth/better-auth';
import authCore from './shared/auth/verify-auth';
import eventsPlugin from './shared/plugins/events.plugin';
import queuePlugin from './shared/plugins/queue.plugin';
import rawBodyPlugin from './shared/plugins/raw-body.plugin';
import { registerEmailHandlers } from './shared/events/handlers/email.handler';
import { registerAnalyticsHandlers } from './shared/events/handlers/analytics.handler';
import { registerInternalHandlers } from './shared/events/handlers/internal.handler';
import { registerOnboardingHandlers } from './modules/onboarding/handlers';

// Infrastructure plugins
import sensiblePlugin from './shared/middleware/sensible';
import corsPlugin from './shared/middleware/cors';
import helmetPlugin from './shared/middleware/helmet';
import rateLimitPlugin from './shared/middleware/rate-limit';
import etagPlugin from './shared/middleware/etag';
import multipartPlugin from './shared/middleware/multipart';

// Logging plugins
import requestLoggerPlugin from './shared/plugins/request-logger.plugin';
import errorHandlerPlugin from './shared/plugins/error-handler.plugin';

/**
 * Application setup
 * Registers all plugins and file-based routes
 */
export default async function app(fastify: FastifyInstance): Promise<void> {
  // 1. Raw body parser (must be first, before any body parsing)
  await fastify.register(rawBodyPlugin);

  // 2. Request logger
  await fastify.register(requestLoggerPlugin);

  // 3. Infrastructure (order matters!)
  await fastify.register(sensiblePlugin);
  await fastify.register(corsPlugin);
  await fastify.register(helmetPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(etagPlugin);
  await fastify.register(multipartPlugin);

  // 4. Core services
  await fastify.register(dbPlugin);
  await fastify.register(eventsPlugin);

  // Only register queue plugin if Redis is available (for production/testing)
  if (process.env.NODE_ENV !== 'development' || process.env.REDIS_HOST) {
    await fastify.register(queuePlugin);
  } else {
    fastify.log.info(
      '⚠️  Queue plugin skipped - Redis not configured for development',
    );
  }

  await fastify.register(betterAuthPlugin);
  await fastify.register(authCore);

  // 5. Register event handlers
  registerEmailHandlers();
  registerAnalyticsHandlers();
  registerInternalHandlers();
  registerOnboardingHandlers();

  // 6. File-based routes (auto-discovery)
  await fastify.register(fileRouterPlugin);

  // 7. Global error handler (last to catch everything)
  await fastify.register(errorHandlerPlugin);

  fastify.log.info('✅ Application setup complete');
}
