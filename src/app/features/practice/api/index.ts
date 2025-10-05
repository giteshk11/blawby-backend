import { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import practiceDetailsApi from './practice-details';
import practiceAuthForwardingApi from './auth-forwarding';

// Main Practice API routes plugin - Combines practice details and auth forwarding
export default fastifyPlugin(async (fastify: FastifyInstance) => {
  // Register practice details API
  await fastify.register(practiceDetailsApi);

  // Register auth forwarding API
  await fastify.register(practiceAuthForwardingApi);
});
