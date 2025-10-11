import { db } from '@/database';
import { events } from '@/shared/events/schemas/events.schema';
import { eventBus } from './event-consumer';
import type {
  BaseEvent,
  EventMetadata,
} from '@/shared/events/schemas/events.schema';
import type { EventType } from '@/shared/events/enums/event-types';
import type { FastifyInstance } from 'fastify';

export const publishEvent = async (
  event: Omit<BaseEvent, 'eventId' | 'timestamp' | 'processed' | 'retryCount'>,
) => {
  const fullEvent: BaseEvent = {
    ...event,
    eventId: crypto.randomUUID(),
    timestamp: new Date(),
    processed: false,
    retryCount: 0,
  };

  // 1. Save to database
  await db.insert(events).values({
    eventId: fullEvent.eventId,
    eventType: fullEvent.eventType,
    eventVersion: fullEvent.eventVersion,
    actorId: fullEvent.actorId,
    actorType: fullEvent.actorType,
    organizationId: fullEvent.organizationId,
    payload: fullEvent.payload,
    metadata: fullEvent.metadata,
    processed: false,
    retryCount: 0,
  });

  // 2. Emit to in-memory event bus for immediate processing
  eventBus.emit(fullEvent.eventType, fullEvent);

  return fullEvent;
};

// Helper function to create event metadata from request context
export const createEventMetadata = (
  source: string,
  request?: {
    headers?: Record<string, string>;
    ip?: string;
    id?: string;
  },
): EventMetadata => {
  return {
    ipAddress: request?.ip,
    userAgent: request?.headers?.['user-agent'],
    requestId: request?.id,
    source,
    environment: process.env.NODE_ENV || 'development',
  };
};

// Helper function for common practice events
export const publishPracticeEvent = async (
  fastify: FastifyInstance,
  eventType: EventType,
  actorId: string,
  organizationId: string,
  payload: Record<string, any>,
  requestHeaders?: Record<string, string>,
) => {
  return fastify.events.publish({
    eventType,
    eventVersion: '1.0.0',
    actorId: actorId,
    actorType: 'user',
    organizationId,
    payload,
    metadata: fastify.events.createMetadata('api', {
      headers: requestHeaders,
    }),
  });
};

// Helper function for user events
export const publishUserEvent = async (
  fastify: FastifyInstance,
  eventType: EventType,
  actorId: string,
  payload: Record<string, any>,
  requestHeaders?: Record<string, string>,
) => {
  return fastify.events.publish({
    eventType,
    eventVersion: '1.0.0',
    actorId: actorId,
    actorType: 'user',
    payload,
    metadata: fastify.events.createMetadata('api', {
      headers: requestHeaders,
    }),
  });
};

// Helper function for system events
export const publishSystemEvent = async (
  fastify: FastifyInstance,
  eventType: EventType,
  payload: Record<string, any>,
  actorId?: string,
  actorType: string = 'system',
  organizationId?: string,
) => {
  return fastify.events.publish({
    eventType,
    eventVersion: '1.0.0',
    actorId,
    actorType,
    organizationId,
    payload,
    metadata: fastify.events.createMetadata('system'),
  });
};
