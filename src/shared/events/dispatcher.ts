/**
 * Event Dispatcher
 *
 * Single function that handles all event publishing
 * Pass parameters and it figures out the correct event type and publisher
 */

import { EventType } from '@/shared/events/enums/event-types';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';
import {
  publishPracticeEvent,
  publishUserEvent,
  publishSystemEvent,
} from '@/shared/events/event-publisher';

type EventParams = {
  eventType: EventType;
  actorId: string; // Who did it (always required)
  organizationId?: string; // Where it happened (optional)
  data: Record<string, unknown>;
  headers?: Record<string, string>;
};

export const publishEvent = async ({
  eventType,
  actorId,
  organizationId,
  data,
  headers,
}: EventParams): Promise<BaseEvent> => {
  // Determine which publisher to use based on event type
  if (eventType.startsWith('PRACTICE_') || eventType.startsWith('BILLING_')) {
    return publishPracticeEvent(
      eventType,
      actorId,
      organizationId || '',
      data,
      headers,
    );
  }

  if (eventType.startsWith('USER_') || eventType.startsWith('AUTH_')) {
    return publishUserEvent(eventType, actorId, data, headers);
  }

  // System events and others
  return publishSystemEvent(eventType, data, actorId, 'system', organizationId);
};
