import { EventEmitter } from 'events';
import { db } from '@/database';
import { events } from '@/shared/events/schemas/events.schema';
import { eq, desc } from 'drizzle-orm';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';

// Global event bus instance
export const eventBus = new EventEmitter();

// Initialize event bus with proper settings
eventBus.setMaxListeners(50); // Support many handlers

// Subscribe to specific event types
export const subscribeToEvent = (
  eventType: string,
  handler: (event: BaseEvent) => Promise<void>,
) => {
  eventBus.on(eventType, async (event) => {
    try {
      await handler(event);
      await markEventAsProcessed(event.eventId);
    } catch (error) {
      await handleEventFailure(event, error);
    }
  });
};

// Subscribe to all events
export const subscribeToAllEvents = (
  handler: (event: BaseEvent) => Promise<void>,
) => {
  eventBus.on('*', async (event) => {
    try {
      await handler(event);
      await markEventAsProcessed(event.eventId);
    } catch (error) {
      await handleEventFailure(event, error);
    }
  });
};

// Remove event subscription
export const unsubscribeFromEvent = (
  eventType: string,
  handler: (event: BaseEvent) => Promise<void>,
) => {
  eventBus.off(eventType, handler);
};

// Remove all event subscription
export const unsubscribeFromAllEvents = (
  handler: (event: BaseEvent) => Promise<void>,
) => {
  eventBus.off('*', handler);
};

const markEventAsProcessed = async (eventId: string) => {
  await db
    .update(events)
    .set({ processed: true, processedAt: new Date() })
    .where(eq(events.eventId, eventId));
};

const handleEventFailure = async (event: BaseEvent, error: any) => {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  await db
    .update(events)
    .set({
      retryCount: event.retryCount + 1,
      lastError: errorMessage,
    })
    .where(eq(events.eventId, event.eventId));
};

// Get unprocessed events for retry
export const getUnprocessedEvents = async (limit = 100) => {
  return await db
    .select()
    .from(events)
    .where(eq(events.processed, false))
    .limit(limit)
    .orderBy(events.createdAt);
};

// Get events by user
export const getEventsByUser = async (
  userId: string,
  limit = 50,
  offset = 0,
) => {
  return await db
    .select()
    .from(events)
    .where(eq(events.userId, userId))
    .limit(limit)
    .offset(offset)
    .orderBy(desc(events.createdAt));
};

// Get events by organization
export const getEventsByOrganization = async (
  organizationId: string,
  limit = 50,
  offset = 0,
) => {
  return await db
    .select()
    .from(events)
    .where(eq(events.organizationId, organizationId))
    .limit(limit)
    .offset(offset)
    .orderBy(desc(events.createdAt));
};
