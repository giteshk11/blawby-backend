import Stripe from 'stripe';
import type { FastifyInstance } from 'fastify';
import { constructWebhookEvent } from '@/modules/onboarding/services/stripe-client.service';
import {
  findByStripeEventId,
  createWebhookEvent,
  markWebhookProcessed,
  markWebhookFailed,
  getEventsToRetry,
} from '@/modules/onboarding/repositories/onboarding.repository';
import { handleAccountUpdated } from '@/modules/onboarding/services/connected-accounts.service';
import { CapabilityUpdatedHandler } from '@/modules/onboarding/handlers/capability-updated.handler';
import { ExternalAccountCreatedHandler } from '@/modules/onboarding/handlers/external-account-created.handler';
import { ExternalAccountUpdatedHandler } from '@/modules/onboarding/handlers/external-account-updated.handler';
import type { NewWebhookEvent } from '@/modules/onboarding/schemas/onboarding.schema';

export const verifyAndStore = async (
  fastify: FastifyInstance,
  rawBody: string | Buffer,
  signature: string,
  headers: Record<string, string>,
  url: string,
): Promise<{ event: Stripe.Event; alreadyProcessed: boolean }> => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
  }

  // Verify signature using Stripe SDK
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature, webhookSecret);
  } catch {
    throw new Error('Invalid signature');
  }

  // Check if event already exists (idempotency)
  const existingEvent = await findByStripeEventId(fastify.db, event.id);

  if (existingEvent) {
    return { event, alreadyProcessed: existingEvent.processed };
  }

  // Store new webhook event
  const newEvent: NewWebhookEvent = {
    stripeEventId: event.id,
    eventType: event.type,
    payload: event as unknown,
    headers,
    url,
  };

  await createWebhookEvent(fastify.db, newEvent);

  return { event, alreadyProcessed: false };
};

export const processEvent = async (
  fastify: FastifyInstance,
  eventId: string,
): Promise<void> => {
  const webhookEvent = await findByStripeEventId(fastify.db, eventId);

  if (!webhookEvent) {
    fastify.log.error(`Webhook event not found: ${eventId}`);
    return;
  }

  if (webhookEvent.processed) {
    fastify.log.info(`Webhook event already processed: ${eventId}`);
    return;
  }

  try {
    const event = webhookEvent.payload as Stripe.Event;

    // Process based on event type
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdatedWebhook(fastify, event);
        break;

      case 'capability.updated':
        await handleCapabilityUpdatedWebhook(fastify, event);
        break;

      case 'account.external_account.created':
        await handleExternalAccountCreatedWebhook(fastify, event);
        break;

      case 'account.external_account.updated':
        await handleExternalAccountUpdatedWebhook(fastify, event);
        break;

      default:
        fastify.log.info(`Unhandled webhook event type: ${event.type}`);
    }

    // Mark as processed
    await markWebhookProcessed(fastify.db, webhookEvent.id);
    fastify.log.info(`Successfully processed webhook event: ${eventId}`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Mark as failed (increments retry count, sets next retry time)
    await markWebhookFailed(
      fastify.db,
      webhookEvent.id,
      errorMessage,
      errorStack,
    );

    fastify.log.error(
      {
        eventId,
        error: errorMessage,
        stack: errorStack,
      },
      'Failed to process webhook event',
    );

    throw error;
  }
};

const handleAccountUpdatedWebhook = async (
  fastify: FastifyInstance,
  event: Stripe.Event,
): Promise<void> => {
  const account = event.data.object as Stripe.Account;

  if (!account.id) {
    fastify.log.error('Account ID missing from account.updated event');
    return;
  }

  await handleAccountUpdated(fastify, account.id, account);
};

const handleCapabilityUpdatedWebhook = async (
  fastify: FastifyInstance,
  event: Stripe.Event,
): Promise<void> => {
  const capability = event.data.object as Stripe.Capability;

  if (!capability.account) {
    fastify.log.error('Account ID missing from capability.updated event');
    return;
  }

  const handler = new CapabilityUpdatedHandler(fastify);
  await handler.handle(event);
};

const handleExternalAccountCreatedWebhook = async (
  fastify: FastifyInstance,
  event: Stripe.Event,
): Promise<void> => {
  const externalAccount = event.data.object as Stripe.ExternalAccount;

  if (!externalAccount.account) {
    fastify.log.error(
      'Account ID missing from account.external_account.created event',
    );
    return;
  }

  const handler = new ExternalAccountCreatedHandler(fastify);
  await handler.handle(event);
};

const handleExternalAccountUpdatedWebhook = async (
  fastify: FastifyInstance,
  event: Stripe.Event,
): Promise<void> => {
  const externalAccount = event.data.object as Stripe.ExternalAccount;

  if (!externalAccount.account) {
    fastify.log.error(
      'Account ID missing from account.external_account.updated event',
    );
    return;
  }

  const handler = new ExternalAccountUpdatedHandler(fastify);
  await handler.handle(event);
};

export const retryFailedWebhooks = async (
  fastify: FastifyInstance,
): Promise<void> => {
  const eventsToRetry = await getEventsToRetry(fastify.db);

  fastify.log.info(`Found ${eventsToRetry.length} webhook events to retry`);

  for (const event of eventsToRetry) {
    try {
      await processEvent(fastify, event.stripeEventId);
    } catch (error) {
      fastify.log.error(
        {
          eventId: event.stripeEventId,
          retryCount: event.retryCount,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to retry webhook event',
      );
    }
  }
};

export const processWebhookAsync = async (
  fastify: FastifyInstance,
  eventId: string,
): Promise<void> => {
  // Use setImmediate for async processing (Phase 1)
  // TODO: Replace with proper job queue in Phase 2
  setImmediate(async () => {
    try {
      await processEvent(fastify, eventId);
    } catch (error) {
      fastify.log.error(
        {
          eventId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Async webhook processing failed',
      );
    }
  });
};
