import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import type { Queue, QueueEvents } from 'bullmq';
import {
  addWebhookJob,
  getQueueStats,
  getWebhookQueue,
  getQueueEvents,
  closeQueues,
} from '@/shared/queue/queue.manager';

/**
 * Fastify plugin that decorates the instance with queue capabilities
 *
 * This plugin provides:
 * - Queue access for adding jobs
 * - Queue statistics for monitoring
 * - Webhook job management
 */
declare module 'fastify' {
  interface FastifyInstance {
    queue: {
      addWebhookJob: (
        webhookId: string,
        eventId: string,
        eventType: string,
      ) => Promise<void>;
      getQueueStats: (queueName: string) => Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
      }>;
      webhookQueue: Queue;
      getQueueEvents: (queueName: string) => QueueEvents;
    };
  }
}

export default fp(async function queuePlugin(fastify: FastifyInstance) {
  // Decorate Fastify instance with queue capabilities
  fastify.decorate('queue', {
    /**
     * Add a webhook processing job to the queue
     *
     * @param webhookId - Database ID of the webhook event
     * @param eventId - Stripe event ID (used for deduplication)
     * @param eventType - Stripe event type (e.g., 'account.updated')
     */
    addWebhookJob: async (
      webhookId: string,
      eventId: string,
      eventType: string,
    ) => {
      try {
        await addWebhookJob(webhookId, eventId, eventType);

        fastify.log.info(
          {
            context: {
              component: 'QueuePlugin',
              operation: 'addWebhookJob',
              webhookId,
              eventId,
              eventType,
            },
          },
          'Webhook job added to queue',
        );
      } catch (error) {
        fastify.log.error(
          {
            error:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                  }
                : error,
            context: {
              component: 'QueuePlugin',
              operation: 'addWebhookJob',
              webhookId,
              eventId,
              eventType,
            },
          },
          'Failed to add webhook job to queue',
        );
        throw error;
      }
    },

    /**
     * Get queue statistics for monitoring
     *
     * @param queueName - Name of the queue to get stats for
     * @returns Queue statistics (waiting, active, completed, failed counts)
     */
    getQueueStats: async (queueName: string) => {
      try {
        const stats = await getQueueStats(queueName);

        fastify.log.debug(
          {
            context: {
              component: 'QueuePlugin',
              operation: 'getQueueStats',
              queueName,
            },
            stats,
          },
          'Retrieved queue statistics',
        );

        return stats;
      } catch (error) {
        fastify.log.error(
          {
            error:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                  }
                : error,
            context: {
              component: 'QueuePlugin',
              operation: 'getQueueStats',
              queueName,
            },
          },
          'Failed to get queue statistics',
        );
        throw error;
      }
    },

    /**
     * Direct access to the webhook queue for advanced operations
     */
    webhookQueue: getWebhookQueue(),

    /**
     * Get QueueEvents for advanced monitoring
     */
    getQueueEvents,
  });

  // Add graceful shutdown hook
  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing queue manager...');
    await closeQueues();
  });

  fastify.log.info('✅ Queue plugin registered');
});
