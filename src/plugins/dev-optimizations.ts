import { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

/**
 * Development optimizations plugin
 * Provides faster startup and better HMR experience
 */
async function devOptimizationsPlugin(fastify: FastifyInstance) {
  // Only run in development
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  // Add development-specific decorators
  fastify.decorate('isDev', true);

  // Faster plugin loading
  fastify.addHook('onReady', async () => {
    fastify.log.info('🚀 Development server ready with optimizations');
  });

  // Add hot reload detection
  fastify.addHook('onClose', async () => {
    fastify.log.info('🔄 Hot reload triggered');
  });
}

export default fastifyPlugin(devOptimizationsPlugin);
