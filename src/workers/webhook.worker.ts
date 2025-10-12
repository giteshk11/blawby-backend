#!/usr/bin/env node

/**
 * Webhook Worker Process
 *
 * This is a separate Node.js process that consumes webhook jobs from the Redis queue.
 * It runs independently from the API server and processes webhooks asynchronously.
 *
 * Architecture:
 * - API Server: Receives webhooks, saves to DB, adds jobs to queue
 * - Worker Process: Consumes jobs from queue, processes webhooks, marks complete
 * - Redis: Message broker connecting them
 *
 * Usage:
 * - Development: `pnpm run worker:dev` (with watch mode)
 * - Production: `pnpm run worker`
 */

import { Worker } from 'bullmq';
import { getRedisConnection } from '@/shared/queue/redis.client';
import { QUEUE_NAMES } from '@/shared/queue/queue.config';
import { config } from '@dotenvx/dotenvx';

// Load environment variables
config();

// Import webhook processing services
import { webhookEvents } from '@/modules/onboarding/schemas/onboarding.schema';
import { processEvent } from '@/modules/onboarding/services/webhooks.service';
import { eq } from 'drizzle-orm';
import { db } from '@/database';

/**
 * Job processing function
 * This function is called for each job in the queue
 */
async function processWebhookJob(job: {
  data: { webhookId: string; eventId: string; eventType: string };
}): Promise<void> {
  const { webhookId, eventId, eventType } = job.data;

  console.log(`Processing webhook job: ${eventId} (${eventType})`);

  try {
    // 1. Fetch webhook from database
    const webhook = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.id, webhookId))
      .limit(1);

    if (webhook.length === 0) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    const webhookRecord = webhook[0];

    // 2. Check if already processed (skip if yes)
    if (webhookRecord.processed) {
      console.log(`Webhook already processed: ${eventId}`);
      return;
    }

    // 3. Create mock Fastify instance for worker
    const mockFastify = {
      log: {
        info: (data: unknown, message: string): void =>
          console.log(`[INFO] ${message}:`, data),
        error: (data: unknown, message: string): void =>
          console.error(`[ERROR] ${message}:`, data),
        warn: (data: unknown, message: string): void =>
          console.warn(`[WARN] ${message}:`, data),
        debug: (data: unknown, message: string): void =>
          console.debug(`[DEBUG] ${message}:`, data),
      },
      events: {
        publish: async (event: { eventType: string }): Promise<void> => {
          console.log(`[EVENT] Publishing: ${event.eventType}`);
        },
        createMetadata: (
          source: string,
        ): { source: string; timestamp: string } => ({
          source,
          timestamp: new Date().toISOString(),
        }),
      },
      db,
    };

    // 4. Process webhook using the existing service
    await processEvent(
      mockFastify as unknown as Parameters<typeof processEvent>[0],
      eventId,
    );

    console.log(`Webhook job completed successfully: ${eventId}`);

    return;
  } catch (error) {
    console.error(`Webhook job failed: ${eventId}`, error);

    // Update webhook record with error
    try {
      await db
        .update(webhookEvents)
        .set({
          error: error instanceof Error ? error.message : 'Unknown error',
          retryCount:
            (
              await db
                .select()
                .from(webhookEvents)
                .where(eq(webhookEvents.id, webhookId))
                .limit(1)
            )[0]?.retryCount + 1 || 1,
        })
        .where(eq(webhookEvents.id, webhookId));
    } catch (updateError) {
      console.error('Failed to update webhook error:', updateError);
    }

    // Re-throw error so BullMQ can handle retries
    throw error;
  }
}

/**
 * Create and configure the worker
 */
const worker = new Worker(
  QUEUE_NAMES.STRIPE_WEBHOOKS, // Listen to this queue
  processWebhookJob, // Job processing function
  {
    connection: getRedisConnection(),
    concurrency: Number(process.env.WEBHOOK_WORKER_CONCURRENCY) || 5,

    // Job processing options
    removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
    removeOnFail: { count: 1000 }, // Keep last 1000 failed jobs
  },
);

/**
 * Event listeners for monitoring and logging
 */

// Job completed successfully
worker.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completed successfully:`, result);
});

// Job failed (after all retries)
worker.on('failed', (job, error) => {
  console.error(`❌ Job ${job?.id} failed:`, error);
});

// Worker error (not job-specific)
worker.on('error', (error) => {
  console.error('🚨 Worker error:', error);
});

// Worker is ready to process jobs
worker.on('ready', () => {
  console.log('🚀 Webhook worker ready to process jobs');
});

// Worker is closing
worker.on('closing', () => {
  console.log('🔄 Webhook worker closing...');
});

// Worker has closed
worker.on('closed', () => {
  console.log('✅ Webhook worker closed');
});

/**
 * Graceful shutdown handling
 */
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n📡 Received ${signal}, shutting down gracefully...`);

  try {
    // Close the worker
    await worker.close();

    // Close Redis connection
    const connection = getRedisConnection();
    await connection.quit();

    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Log startup information
console.log('🔧 Webhook Worker Configuration:');
console.log(`  - Queue: ${QUEUE_NAMES.STRIPE_WEBHOOKS}`);
console.log(
  `  - Concurrency: ${Number(process.env.WEBHOOK_WORKER_CONCURRENCY) || 5}`,
);
console.log(`  - Redis Host: ${process.env.REDIS_HOST || 'localhost'}`);
console.log(`  - Redis Port: ${process.env.REDIS_PORT || 6379}`);
console.log(`  - Max Retries: ${Number(process.env.WEBHOOK_MAX_RETRIES) || 5}`);
console.log('');

// Start the worker
console.log('🚀 Starting webhook worker...');
