import { EventType } from '@/shared/events/enums/event-types';
import {
  subscribeToAllEvents,
  subscribeToEvent,
} from '@/shared/events/event-consumer';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';

// Mock analytics service - replace with actual analytics service
const trackEvent = async (params: {
  event: string;
  userId?: string;
  properties: Record<string, unknown>;
  timestamp: Date;
}): Promise<void> => {
  console.log(`📊 Analytics: ${params.event} for user ${params.userId}`);
  // TODO: Implement actual analytics tracking (e.g., Mixpanel, Amplitude)
};

const trackConversion = async (params: {
  event: string;
  userId?: string;
  organizationId?: string;
  value: number;
}): Promise<void> => {
  console.log(`💰 Conversion: ${params.event} - $${params.value}`);
  // TODO: Implement actual conversion tracking
};

export const registerAnalyticsHandlers = (): void => {
  // Track all events to analytics
  subscribeToAllEvents(async (event: BaseEvent) => {
    await trackEvent({
      event: event.eventType,
      userId: event.actorId,
      properties: event.payload,
      timestamp: event.timestamp,
    });
  });

  // Track specific conversion events
  subscribeToEvent(EventType.ONBOARDING_COMPLETED, async (event: BaseEvent) => {
    await trackConversion({
      event: 'stripe_connected',
      userId: event.actorId,
      organizationId: event.organizationId,
      value: 0, // or estimated value
    });
  });

  // Track user signup conversion
  subscribeToEvent(EventType.AUTH_USER_SIGNED_UP, async (event: BaseEvent) => {
    await trackConversion({
      event: 'user_signup',
      userId: event.actorId,
      value: 1,
    });
  });

  // Track practice creation
  subscribeToEvent(EventType.PRACTICE_CREATED, async (event: BaseEvent) => {
    await trackConversion({
      event: 'organization_created',
      userId: event.actorId,
      organizationId: event.organizationId,
      value: 1,
    });
  });

  // Track payment events
  subscribeToEvent(EventType.PAYMENT_RECEIVED, async (event: BaseEvent) => {
    const { amount } = event.payload;

    await trackConversion({
      event: 'payment_received',
      organizationId: event.organizationId,
      value: amount as number,
    });
  });
};
