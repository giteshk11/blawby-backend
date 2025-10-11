# Blawby Event-Driven Architecture Plan

## Executive Summary

This document outlines the implementation plan for an event-driven architecture in Blawby, covering all critical user journeys from authentication to billing.

---

## 1. Event Categories & Identification

### **Naming Convention: `{domain}.{object}_{past_tense_verb}`**

Industry standard format using:

- Domain namespacing with dots (.)
- Object-action with underscores (\_)
- Past tense verbs (indicates completed action)
- snake_case for consistency
- Clear, descriptive names

### Authentication Events

```typescript
// User registration and login
'auth.user_signed_up'; // New user account created
'auth.email_verified'; // Email verification completed
'auth.user_logged_in'; // User session started
'auth.user_logged_out'; // User session ended
'auth.password_reset_requested'; // Password reset initiated
'auth.password_changed'; // Password successfully changed
'auth.account_deleted'; // User account removed
```

### Onboarding Events

```typescript
// User onboarding flow
'onboarding.started'; // User begins onboarding
'onboarding.step_completed'; // Individual step finished
'onboarding.completed'; // Full onboarding finished
'onboarding.skipped'; // User skips onboarding

// Profile setup
'profile.created'; // Initial profile setup
'profile.updated'; // Profile information changed
'profile.picture_uploaded'; // Profile image added
```

### Organization/Practice Events

```typescript
// Practice/Organization management
'org.created'; // New practice/organization created
'org.updated'; // Organization details modified
'org.deleted'; // Organization removed

// Member management
'org.member_invited'; // Team member invitation sent
'org.member_joined'; // User accepted invitation
'org.member_role_changed'; // Member role updated
'org.member_removed'; // Member removed from organization
'org.member_left'; // Member left organization

// Organization switching
'org.switched'; // User changed active organization
'org.access_denied'; // Unauthorized access attempt
```

### Billing & Payment Events

```typescript
// Stripe onboarding
'billing.onboarding_started'; // Stripe connect initiated
'billing.onboarding_completed'; // Stripe account fully connected
'billing.onboarding_failed'; // Onboarding process failed

// Payment processing
'billing.payment_session_created'; // Payment session initiated
'billing.payment_received'; // Payment successfully processed
'billing.payment_failed'; // Payment processing failed
'billing.payment_refunded'; // Payment refunded

// Stripe account events
'billing.account_updated'; // Connected account details changed
'billing.account_requirements_changed'; // Account requirements updated
'billing.account_capabilities_updated'; // Account capabilities changed

// Webhook events
'billing.webhook_received'; // Stripe webhook received
'billing.webhook_processed'; // Webhook successfully processed
'billing.webhook_failed'; // Webhook processing failed
```

### Practice Details Events

```typescript
// Practice information
'practice.details_created'; // Practice details added
'practice.details_updated'; // Practice information modified
'practice.specialties_updated'; // Practice specialties changed
'practice.contact_info_updated'; // Contact information changed
```

### System Events

```typescript
// System and monitoring
'system.health_check_performed'; // Health check performed
'system.error_occurred'; // System error occurred
'system.performance_degraded'; // Performance issues detected

// Session management
'session.created'; // New session established
'session.expired'; // Session expiration
'session.invalidated'; // Session manually invalidated
```

---

## 2. Event Schema Design

### Standard Event Structure

```typescript
interface BaseEvent {
  eventId: string; // Unique event identifier (UUID)
  eventType: string; // Event type (e.g., 'user.signed_up')
  eventVersion: string; // Event schema version (e.g., '1.0.0')
  timestamp: Date; // Event occurrence time (ISO 8601)

  // Actor information (UPDATED)
  actor?: string; // Who/what performed the action (user ID, system, etc.)
  actorType?: string; // Type of actor: 'user', 'system', 'webhook', etc.
  organizationId?: string; // Context where the event happened (optional)

  // Event data
  payload: Record<string, any>; // Event-specific data
  metadata: EventMetadata; // Additional context

  // Processing status
  processed: boolean; // Has event been processed
  retryCount: number; // Number of processing attempts
}

interface EventMetadata {
  ipAddress?: string; // Request IP address
  userAgent?: string; // Browser/client info
  requestId?: string; // Request correlation ID
  source: string; // Event source (e.g., 'api', 'webhook')
  environment: string; // 'development' | 'staging' | 'production'
}
```

### Example Event Payloads (Updated with Actor System)

```typescript
// user.signed_up
{
  eventType: 'user.signed_up',
  actor: 'user_abc123', // UPDATED: actor instead of userId
  actorType: 'user', // UPDATED: explicit actor type
  payload: {
    email: 'user@example.com',
    name: 'John Doe',
    signupMethod: 'email', // 'email' | 'google' | 'github'
    referralSource?: 'organic' | 'referral' | 'paid',
    referralCode?: 'REF123'
  },
  metadata: {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
    source: 'api'
  }
}

// organization.created
{
  eventType: 'organization.created',
  actor: 'user_abc123', // UPDATED: actor instead of userId
  actorType: 'user', // UPDATED: explicit actor type
  organizationId: 'org_xyz789',
  payload: {
    organizationName: 'ABC Practice',
    organizationSlug: 'abc-practice',
    practiceType: 'dental',
    role: 'owner'
  }
}

// billing.onboarding_completed
{
  eventType: 'billing.onboarding_completed',
  actor: 'webhook-stripe', // UPDATED: webhook as actor
  actorType: 'webhook', // UPDATED: explicit actor type
  organizationId: 'org_xyz789',
  payload: {
    stripeAccountId: 'acct_123',
    connectedAccountId: 'ca_456',
    chargesEnabled: true,
    payoutsEnabled: true
  }
}

// payment.received
{
  eventType: 'payment.received',
  actor: 'system', // UPDATED: system as actor
  actorType: 'system', // UPDATED: explicit actor type
  organizationId: 'org_xyz789',
  payload: {
    paymentIntentId: 'pi_123',
    amount: 5000, // cents
    currency: 'usd',
    customerEmail: 'patient@example.com',
    stripeAccountId: 'acct_123',
    applicationFeeAmount: 500
  }
}
```

---

## 3. Database Schema

### Events Table

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event identification
  event_id VARCHAR(100) UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  event_type VARCHAR(100) NOT NULL,
  event_version VARCHAR(20) DEFAULT '1.0.0' NOT NULL,

  -- Actor information
  actor TEXT, -- Who/what performed the action (user ID, system, etc.)
  actor_type TEXT, -- Type of actor: 'user', 'system', 'webhook', etc.
  organization_id TEXT REFERENCES "organization"(id) ON DELETE SET NULL,

  -- Event data
  payload JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',

  -- Processing status
  processed BOOLEAN DEFAULT false NOT NULL,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  last_error TEXT,
  processed_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,

  -- Indexes for performance
  INDEX idx_event_type (event_type),
  INDEX idx_actor (actor),
  INDEX idx_actor_type (actor_type),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_processed (processed, created_at),
  INDEX idx_event_type_created (event_type, created_at)
);

-- Composite index for actor event timeline
CREATE INDEX idx_actor_events ON events(actor, created_at DESC)
WHERE actor IS NOT NULL;

-- Composite index for organization events
CREATE INDEX idx_org_events ON events(organization_id, created_at DESC)
WHERE organization_id IS NOT NULL;
```

### Event Subscriptions Table (Optional - for user preferences)

```sql
CREATE TABLE event_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  channel VARCHAR(50) NOT NULL, -- 'email', 'webhook', 'in_app'
  enabled BOOLEAN DEFAULT true NOT NULL,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,

  UNIQUE(user_id, event_type, channel)
);
```

---

## 4. Implementation Plan

### Phase 1: Foundation ✅ COMPLETED

#### Step 1.1: Create Event Infrastructure ✅

```typescript
// src/shared/events/event-publisher.ts
import { db } from '@/database';
import { events } from '@/shared/events/schemas/events.schema';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';

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
    actor: fullEvent.actor,
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
```

#### Step 1.2: Create Event Consumer ✅

```typescript
// src/shared/events/event-consumer.ts
import { EventEmitter } from 'events';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';

export const eventBus = new EventEmitter();

// Subscribe to specific event types
export const subscribeToEvent = (
  eventType: string,
  handler: (event: BaseEvent) => Promise<void>,
) => {
  eventBus.on(eventType, async (event) => {
    try {
      await handler(event);
    } catch (error) {
      console.error(`Error processing event ${eventType}:`, error);
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
    } catch (error) {
      console.error('Error processing event:', error);
    }
  });
};
```

#### Step 1.3: Create Fastify Plugin ✅

```typescript
// src/shared/plugins/events.plugin.ts
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { publishEvent } from '@/shared/events/event-publisher';
import { createEventMetadata } from '@/shared/events/event-publisher';

declare module 'fastify' {
  interface FastifyInstance {
    events: {
      publish: typeof publishEvent;
      createMetadata: typeof createEventMetadata;
    };
  }
}

export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate('events', {
    publish: publishEvent,
    createMetadata: createEventMetadata,
  });

  fastify.log.info('✅ Events plugin registered');
});
```

### Phase 2: Integrate Events ✅ COMPLETED

#### Step 2.1: Integrate with Authentication ✅

```typescript
// src/shared/auth/better-auth.ts (add after session creation)
// In database hooks
export const betterAuthPlugin = fp(async (fastify: FastifyInstance) => {
  // ... existing setup ...

  // Add event publishing after session creation
  databaseHooks: {
    session: {
      create: {
        after: async (sessionData: {
          userId: string;
          id: string;
          [key: string]: unknown;
        }) => {
          // Publish session created event if events are available
          if (fastify?.events) {
            try {
              await fastify.events.publish({
                eventType: EventType.SESSION_CREATED,
                eventVersion: '1.0.0',
                actor: sessionData.userId, // UPDATED: actor instead of userId
                actorType: 'user', // UPDATED: explicit actor type
                payload: {
                  sessionId: sessionData.id,
                  activeOrganizationId: sessionData.activeOrganizationId,
                },
                metadata: fastify.events.createMetadata('auth'),
              });
            } catch (error) {
              fastify.log.error(
                { error, userId: sessionData.userId },
                'Failed to publish session created event',
              );
            }
          }
        },
      },
    },
  },
});
```

#### Step 2.2: Integrate with Practice Module ✅

```typescript
// src/modules/practice/services/organization.service.ts
export const createOrganization = async (
  data: CreateOrganizationDto,
  user: User,
  fastify: FastifyInstance,
  requestHeaders: Record<string, string>,
) => {
  const result = await fastify.betterAuth.api.createOrganization({
    body: data,
    headers: requestHeaders,
  });

  // Publish practice created event
  await publishEvent({
    fastify,
    eventType: EventType.PRACTICE_CREATED,
    actorId: user.id, // UPDATED: actorId parameter name
    organizationId: result?.id || 'unknown',
    data: {
      organizationName: result?.name || 'Unknown',
      organizationSlug: result?.slug || 'unknown',
      role: 'owner',
      userEmail: user.email,
    },
    headers: requestHeaders,
  });

  return result;
};
```

#### Step 2.3: Integrate with Billing Module ✅

```typescript
// src/modules/onboarding/services/connected-accounts.service.ts
export const createOrGetAccount = async (
  fastify: FastifyInstance,
  organizationId: string,
  email: string,
): Promise<CreateAccountResponse> => {
  // ... existing logic ...

  // Publish billing onboarding started event
  await fastify.events.publish({
    eventType: EventType.BILLING_ONBOARDING_STARTED,
    eventVersion: '1.0.0',
    actor: 'system',
    actorType: 'system',
    organizationId,
    payload: {
      accountId: stripeAccount.id,
      email,
      country: 'US',
    },
    metadata: fastify.events.createMetadata('api'),
  });

  return {
    accountId: stripeAccount.id,
    clientSecret: session.client_secret,
    expiresAt: session.expires_at,
    status: {
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      detailsSubmitted: account.detailsSubmitted,
    },
  };
};
```

### Phase 3: Event Handlers ✅ COMPLETED

#### Step 3.1: Email Notification Handler ✅

```typescript
// src/shared/events/handlers/email.handler.ts
import { subscribeToEvent } from '@/shared/events/event-consumer';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';
import { EventType } from '@/shared/events/enums/event-types';

export const registerEmailHandlers = () => {
  // Welcome email on signup
  subscribeToEvent(EventType.AUTH_USER_SIGNED_UP, async (event: BaseEvent) => {
    const { email, name } = event.payload;

    await sendEmail({
      to: email,
      subject: 'Welcome to Blawby!',
      template: 'welcome',
      data: { name },
    });
  });

  // Onboarding reminder
  subscribeToEvent(
    EventType.BILLING_ONBOARDING_STARTED,
    async (event: BaseEvent) => {
      // Schedule reminder email in 24h if not completed
      const { email } = event.payload;

      setTimeout(
        async () => {
          // Check if onboarding is still incomplete
          await sendEmail({
            to: email,
            subject: 'Complete your Blawby setup',
            template: 'onboarding-reminder',
          });
        },
        24 * 60 * 60 * 1000,
      ); // 24 hours
    },
  );

  // Payment receipt
  subscribeToEvent(
    EventType.BILLING_PAYMENT_RECEIVED,
    async (event: BaseEvent) => {
      const { customerEmail, amount, currency } = event.payload;

      await sendEmail({
        to: customerEmail,
        subject: 'Payment Receipt',
        template: 'payment-receipt',
        data: { amount, currency },
      });
    },
  );
};
```

#### Step 3.2: Analytics Handler ✅

```typescript
// src/shared/events/handlers/analytics.handler.ts
import {
  subscribeToAllEvents,
  subscribeToEvent,
} from '@/shared/events/event-consumer';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';
import { EventType } from '@/shared/events/enums/event-types';

export const registerAnalyticsHandlers = () => {
  // Track all events to analytics
  subscribeToAllEvents(async (event: BaseEvent) => {
    await trackEvent({
      event: event.eventType,
      userId: event.actor,
      properties: event.payload,
      timestamp: event.timestamp,
    });
  });

  // Track specific conversion events
  subscribeToEvent(
    EventType.BILLING_ONBOARDING_COMPLETED,
    async (event: BaseEvent) => {
      await trackConversion({
        event: 'stripe_connected',
        userId: event.actor,
        organizationId: event.organizationId,
        value: 0, // or estimated value
      });
    },
  );
};
```

#### Step 3.3: Internal Notification Handler ✅

```typescript
// src/shared/events/handlers/internal.handler.ts
import { subscribeToEvent } from '@/shared/events/event-consumer';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';
import { EventType } from '@/shared/events/enums/event-types';

export const registerInternalHandlers = () => {
  // Notify team on new signups
  subscribeToEvent(EventType.AUTH_USER_SIGNED_UP, async (event: BaseEvent) => {
    await notifySlack({
      channel: '#signups',
      text: `🎉 New user signed up: ${event.payload.email}`,
      fields: {
        'Signup Method': event.payload.signupMethod || 'email',
        'Referral Source': event.payload.referralSource || 'organic',
        'User ID': event.actor || 'unknown',
      },
    });
  });

  // Alert on failed payments
  subscribeToEvent(
    EventType.BILLING_PAYMENT_FAILED,
    async (event: BaseEvent) => {
      await notifySlack({
        channel: '#alerts',
        text: `⚠️ Payment failed for organization ${event.organizationId}`,
        fields: {
          Amount: `$${(event.payload.amount / 100).toFixed(2)}`,
          Error: event.payload.error || 'Unknown error',
          Customer: event.payload.customerEmail || 'Unknown',
        },
      });
    },
  );
};
```

### Phase 4: Advanced Features (Week 4)

#### Step 4.1: Event Replay System

```typescript
// src/shared/events/event-replay.ts
export class EventReplayService {
  async replayEvents(filters: {
    eventTypes?: string[];
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const events = await this.fetchEvents(filters);

    for (const event of events) {
      await this.eventBus.emit(event.eventType, event);
    }
  }

  async replayForUser(userId: string) {
    return this.replayEvents({ userId });
  }
}
```

#### Step 4.2: Event Timeline API

```typescript
// src/modules/events/routes/timeline.get.ts
export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/timeline',
    {
      schema: {
        querystring: z.object({
          userId: z.string().optional(),
          organizationId: z.string().optional(),
          eventTypes: z.array(z.string()).optional(),
          limit: z.number().default(50),
          offset: z.number().default(0),
        }),
      },
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const { userId, organizationId, eventTypes, limit, offset } =
        request.query;

      const events = await db
        .select()
        .from(eventsTable)
        .where(
          and(
            userId ? eq(eventsTable.userId, userId) : undefined,
            organizationId
              ? eq(eventsTable.organizationId, organizationId)
              : undefined,
            eventTypes ? inArray(eventsTable.eventType, eventTypes) : undefined,
          ),
        )
        .orderBy(desc(eventsTable.createdAt))
        .limit(limit)
        .offset(offset);

      return { events };
    },
  );
}
```

---

## 5. Event Handler Registration ✅ COMPLETED

```typescript
// src/app.ts (add to main application setup)
import { registerEmailHandlers } from '@/shared/events/handlers/email.handler';
import { registerAnalyticsHandlers } from '@/shared/events/handlers/analytics.handler';
import { registerInternalHandlers } from '@/shared/events/handlers/internal.handler';

export default async function app(fastify: FastifyInstance) {
  // ... existing plugins ...

  // 2. Core services
  await fastify.register(dbPlugin);
  await fastify.register(betterAuthPlugin);
  await fastify.register(authCore);
  await fastify.register(eventsPlugin);

  // 3. Register event handlers
  registerEmailHandlers();
  registerAnalyticsHandlers();
  registerInternalHandlers();

  // ... rest of setup ...
}
```

---

## 6. Testing Strategy

### Unit Tests

```typescript
// test/events/event-publisher.test.ts
import { test } from 'tap';
import { EventPublisher } from '@/shared/events/event-publisher';

test('EventPublisher should publish events', async (t) => {
  const publisher = new EventPublisher();

  const event = await publisher.publish({
    eventType: 'user.signed_up',
    eventVersion: '1.0.0',
    userId: 'user_123',
    payload: { email: 'test@example.com' },
    metadata: { source: 'test' },
  });

  t.ok(event.eventId);
  t.equal(event.eventType, 'user.signed_up');
});
```

### Integration Tests

```typescript
// test/events/handlers.test.ts
test('Email handler should send welcome email', async (t) => {
  const events = new EventConsumer();
  registerEmailHandlers(events);

  await events.emit('user.signed_up', {
    eventType: 'user.signed_up',
    payload: { email: 'test@example.com', name: 'Test User' },
  });

  // Assert email was sent
  const sentEmails = await getTestEmails();
  t.equal(sentEmails.length, 1);
  t.equal(sentEmails[0].to, 'test@example.com');
});
```

---

## 7. Monitoring & Observability

### Event Metrics Dashboard

```typescript
// Track key metrics
- Events published per minute
- Events processed per minute
- Failed events count
- Average processing time
- Event type distribution
- Retry counts
```

### Health Check Enhancement

```typescript
// src/modules/health/routes/index.get.ts
export default async function (fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const unprocessedEvents = await db
      .select()
      .from(events)
      .where(eq(events.processed, false))
      .count();

    return {
      status: 'healthy',
      timestamp: new Date(),
      events: {
        unprocessed: unprocessedEvents[0].count,
        healthy: unprocessedEvents[0].count < 1000,
      },
    };
  });
}
```

---

## 8. Migration Path ✅ COMPLETED

### Week 1: Setup ✅

- ✅ Create events table with actor/actorType fields
- ✅ Implement event publisher and consumer (function-based)
- ✅ Create Fastify plugin
- ✅ Create event dispatcher for unified publishing

### Week 2: Integration ✅

- ✅ Integrate with authentication (session creation events)
- ✅ Integrate with practice module (CRUD events)
- ✅ Integrate with billing module (onboarding events)

### Week 3: Handlers ✅

- ✅ Implement email handlers
- ✅ Implement analytics handlers
- ✅ Implement internal notifications
- ✅ Register all handlers in app.ts

### Week 4: Polish (Future)

- ⏳ Add event replay system
- ⏳ Add timeline API
- ⏳ Add comprehensive tests
- ⏳ Add monitoring

---

## 9. Future Enhancements

### Event Sourcing

- Rebuild state from events
- Audit trail for compliance
- Time-travel debugging

### Event Streaming

- Redis Streams for high throughput
- Kafka for production scale
- Event replay capabilities

### Advanced Analytics

- User journey tracking
- Conversion funnel analysis
- Cohort analysis

---

## 10. Best Practices

### Event Design

- Events should be immutable
- Include all relevant context
- Use past tense for event names
- Version your events

### Error Handling

- Implement retry logic
- Log all failures
- Alert on critical failures
- Implement dead letter queue

### Performance

- Process events asynchronously
- Use batch processing where possible
- Monitor processing time
- Scale consumers independently

---

## Conclusion

This event-driven architecture provides:

- ✅ Complete audit trail
- ✅ Decoupled services
- ✅ Easy feature additions
- ✅ Scalable architecture
- ✅ Analytics foundation
- ✅ User engagement automation
- ✅ Flexible actor system (user, system, webhook, etc.)
- ✅ Function-based implementation (no classes)
- ✅ Single event dispatcher for all event types
- ✅ Comprehensive event handlers (email, analytics, internal)
