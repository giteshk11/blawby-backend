import { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import connectedAccounts from './api/connected-accounts';

// Stripe feature exports
export * from './database/schema';
export * from './types';
export * from './services';
export * from './database/queries';

// Stripe feature plugin that registers all Stripe-related routes
export default fastifyPlugin(async (fastify: FastifyInstance) => {
  // Register connected accounts routes
  await fastify.register(connectedAccounts);
});
