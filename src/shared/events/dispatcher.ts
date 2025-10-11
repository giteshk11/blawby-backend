/**
 * Event Dispatcher
 *
 * Single function that handles all event publishing
 * Pass parameters and it figures out the correct event type and publisher
 */

import type { FastifyInstance } from 'fastify';
import { EventType } from '@/shared/events/enums/event-types';
import {
  publishPracticeEvent,
  publishUserEvent,
  publishSystemEvent,
} from '@/shared/events/event-publisher';

type EventParams = {
  fastify: FastifyInstance;
  eventType: EventType;
  actorId: string; // Who did it (always required)
  organizationId?: string; // Where it happened (optional)
  data: any;
  headers?: Record<string, string>;
};

export const publishEvent = async ({
  fastify,
  eventType,
  actorId,
  organizationId,
  data,
  headers,
}: EventParams) => {
  // Determine which publisher to use based on event type
  if (eventType.startsWith('PRACTICE_') || eventType.startsWith('BILLING_')) {
    return publishPracticeEvent(
      fastify,
      eventType,
      actorId,
      organizationId || '',
      data,
      headers,
    );
  }

  if (eventType.startsWith('USER_') || eventType.startsWith('AUTH_')) {
    return publishUserEvent(fastify, eventType, actorId, data, headers);
  }

  // System events and others
  return publishSystemEvent(
    fastify,
    eventType,
    data,
    actorId,
    'system',
    organizationId,
  );
};
