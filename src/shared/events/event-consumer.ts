import { EventEmitter } from 'events';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/shared/database';
import { EventType } from '@/shared/events/enums/event-types';
import { events } from '@/shared/events/schemas/events.schema';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';

// Global event bus instance
export const eventBus = new EventEmitter();

// Initialize event bus with proper settings
eventBus.setMaxListeners(50); // Support many handlers

// Subscribe to specific event types
export const subscribeToEvent = (
  eventType: string,
  handler: (event: BaseEvent) => Promise<void>,
): void => {
  eventBus.on(eventType, async (event) => {
    try {
      await handler(event);
      // Mark as processed asynchronously (don't await)
      markEventAsProcessed(event.eventId).catch((error) => {
        console.error(`Failed to mark event ${event.eventId} as processed:`, error);
      });
    } catch (error) {
      console.error(`Event handler failed for ${eventType}:`, error);
      // Mark failure asynchronously (don't await)
      handleEventFailure(event, error).catch((err) => {
        console.error(`Failed to handle event failure for ${event.eventId}:`, err);
      });
    }
  });
};

// Subscribe to all events by listening to each event type
export const subscribeToAllEvents = (
  handler: (event: BaseEvent) => Promise<void>,
): void => {
  // Listen to all event types
  Object.values(EventType).forEach((eventType) => {
    eventBus.on(eventType, async (event) => {
      try {
        await handler(event);
        // Mark as processed asynchronously (don't await)
        markEventAsProcessed(event.eventId).catch((error) => {
          console.error(`Failed to mark event ${event.eventId} as processed:`, error);
        });
      } catch (error) {
        console.error(`Event handler failed for ${eventType}:`, error);
        // Mark failure asynchronously (don't await)
        handleEventFailure(event, error).catch((err) => {
          console.error(`Failed to handle event failure for ${event.eventId}:`, err);
        });
      }
    });
  });
};

// Auto-save all events to database
subscribeToAllEvents(async (event) => {
  try {
    await db.insert(events).values({
      eventId: event.eventId,
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      actorId: event.actorId,
      actorType: event.actorType,
      organizationId: event.organizationId,
      payload: event.payload,
      metadata: event.metadata,
      processed: false,
      retryCount: 0,
    });
  } catch (error) {
    console.error(`Failed to save event ${event.eventId} to database:`, error);
  }
});

// Remove event subscription
export const unsubscribeFromEvent = (
  eventType: string,
  handler: (event: BaseEvent) => Promise<void>,
): void => {
  eventBus.off(eventType, handler);
};

// Remove all event subscription
export const unsubscribeFromAllEvents = (
  handler: (event: BaseEvent) => Promise<void>,
): void => {
  eventBus.off('*', handler);
};

const markEventAsProcessed = async (eventId: string): Promise<void> => {
  await db
    .update(events)
    .set({ processed: true, processedAt: new Date() })
    .where(eq(events.eventId, eventId));
};

const handleEventFailure = async (
  event: BaseEvent,
  error: unknown,
): Promise<void> => {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  await db
    .update(events)
    .set({
      retryCount: (event as { retryCount: number }).retryCount + 1,
      lastError: errorMessage,
    })
    .where(eq(events.eventId, event.eventId));
};

// Get unprocessed events for retry
export const getUnprocessedEvents = async (
  limit = 100,
): Promise<BaseEvent[]> => {
  const results = await db
    .select()
    .from(events)
    .where(eq(events.processed, false))
    .limit(limit)
    .orderBy(events.createdAt);

  return results.map((event) => ({
    ...event,
    timestamp: event.createdAt,
    actorId: event.actorId ?? undefined,
    actorType: event.actorType ?? undefined,
    organizationId: event.organizationId ?? undefined,
    payload: event.payload as Record<string, unknown>,
  }));
};

// Get events by user
export const getEventsByUser = async (
  userId: string,
  limit = 50,
  offset = 0,
): Promise<BaseEvent[]> => {
  const results = await db
    .select()
    .from(events)
    .where(eq(events.actorId, userId))
    .limit(limit)
    .offset(offset)
    .orderBy(desc(events.createdAt));

  return results.map((event) => ({
    ...event,
    timestamp: event.createdAt,
    actorId: event.actorId ?? undefined,
    actorType: event.actorType ?? undefined,
    organizationId: event.organizationId ?? undefined,
    payload: event.payload as Record<string, unknown>,
  }));
};

// Get events by organization
export const getEventsByOrganization = async (
  organizationId: string,
  limit = 50,
  offset = 0,
): Promise<BaseEvent[]> => {
  const results = await db
    .select()
    .from(events)
    .where(eq(events.organizationId, organizationId))
    .limit(limit)
    .offset(offset)
    .orderBy(desc(events.createdAt));

  return results.map((event) => ({
    ...event,
    timestamp: event.createdAt,
    actorId: event.actorId ?? undefined,
    actorType: event.actorType ?? undefined,
    organizationId: event.organizationId ?? undefined,
    payload: event.payload as Record<string, unknown>,
  }));
};
