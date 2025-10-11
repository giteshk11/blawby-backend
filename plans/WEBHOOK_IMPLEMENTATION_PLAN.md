# Stripe Webhook Implementation - BullMQ + Redis

## Architecture Overview

```
Stripe → Webhook Endpoint → Verify Signature → Save to DB → Queue to Redis → Return 200 OK
                                                                      ↓
                                                            Worker Process (async)
                                                                      ↓
                                                            Fetch → Process → Mark Complete
```

**Key Principles:**
- Save webhook BEFORE queueing (data safety)
- Check idempotency BEFORE saving (prevent duplicates)
- Respond <100ms (Stripe requirement)
- Process async in worker (scalability)
- Auto-retry with exponential backoff (reliability)

---

## Phase 1: Dependencies & Setup

### Install Packages
```bash
pnpm add bullmq ioredis
pnpm add -D @types/ioredis
```

### Environment Variables
```env
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Stripe
STRIPE_WEBHOOK_SECRET=whsec_...

# Worker
WEBHOOK_WORKER_CONCURRENCY=5
WEBHOOK_MAX_RETRIES=5
```

---

## Phase 2: Database Schema

### Migration: `webhook_events` Table

```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false NOT NULL,
  processed_at TIMESTAMP,
  error TEXT,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  received_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Critical indexes
CREATE UNIQUE INDEX idx_webhook_stripe_event_id ON webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_processed ON webhook_events(processed, created_at);
CREATE INDEX idx_webhook_event_type ON webhook_events(event_type);
```

**Why this schema:**
- `stripe_event_id` UNIQUE: Idempotency (prevent duplicate processing)
- `processed` boolean: Track processing state
- `payload` JSONB: Store full Stripe event for replay
- `retry_count`: Track retry attempts
- Indexes: Fast lookups for unprocessed webhooks

### Drizzle Schema

**File:** `src/modules/billing/schemas/webhook.schema.ts`

Create schema matching the migration with proper TypeScript types.

### Repository Pattern

**File:** `src/modules/billing/repositories/webhook.repository.ts`

Implement methods:
- `existsByStripeEventId(stripeEventId: string): Promise<boolean>` - Idempotency check
- `create(event: Stripe.Event)` - Save webhook
- `findById(id: string)` - Fetch webhook
- `markProcessed(id: string)` - Mark complete
- `markFailed(id: string, error: Error)` - Mark failed + increment retry

---

## Phase 3: Redis & Queue Setup

**Understanding BullMQ Architecture:**

```
API Server (produces jobs)          Worker Process (consumes jobs)
       ↓                                      ↓
   Queue.add()                          Worker.process()
       ↓                                      ↓
       └─────────→  Redis  ←─────────────────┘
```

- **Queue**: Used in API to ADD jobs (producer)
- **Worker**: Separate process to PROCESS jobs (consumer)
- **Redis**: Message broker connecting them

### Redis Connection

**File:** `src/shared/queue/redis.client.ts`

```typescript
import Redis from 'ioredis';

export const redisConnection = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  db: Number(process.env.REDIS_DB),
  maxRetriesPerRequest: null, // REQUIRED for BullMQ
  enableReadyCheck: false,
});
```

**Critical:** `maxRetriesPerRequest: null` is REQUIRED for BullMQ compatibility.

### Queue Configuration

**File:** `src/shared/queue/queue.config.ts`

Define constants and default job options:

```typescript
export const QUEUE_NAMES = {
  STRIPE_WEBHOOKS: 'stripe-webhooks',
} as const;

export const JOB_NAMES = {
  PROCESS_WEBHOOK: 'process-webhook',
} as const;

export const queueConfig = {
  defaultJobOptions: {
    attempts: Number(process.env.WEBHOOK_MAX_RETRIES) || 5,
    backoff: {
      type: 'exponential' as const,
      delay: 60000, // Start with 1 minute
    },
    removeOnComplete: 100,  // Keep last 100 completed jobs
    removeOnFail: 1000,     // Keep last 1000 failed jobs
  },
};
```

**Retry Behavior:**
- Retry delays: 1min → 2min → 4min → 8min → 16min
- After 5 failed attempts, job moves to "failed" state
- Failed jobs kept in Redis for debugging

### BullMQ Queue Setup

**File:** `src/shared/queue/queue.manager.ts`

Create a QueueManager class that initializes and manages BullMQ queues:

```typescript
import { Queue } from 'bullmq';
import { redisConnection } from './redis.client';
import { QUEUE_NAMES, queueConfig } from './queue.config';

class QueueManager {
  private queues: Map<string, Queue> = new Map();

  getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, {
        connection: redisConnection,
        defaultJobOptions: queueConfig.defaultJobOptions,
      });
      this.queues.set(name, queue);
    }
    return this.queues.get(name)!;
  }

  get webhookQueue(): Queue {
    return this.getQueue(QUEUE_NAMES.STRIPE_WEBHOOKS);
  }

  async close() {
    await Promise.all(
      Array.from(this.queues.values()).map(q => q.close())
    );
    await redisConnection.quit();
  }
}

export const queueManager = new QueueManager();
```

**Key Points:**
- The `Queue` class is used to ADD jobs to the queue (from API endpoint)
- Separate `Worker` class will CONSUME jobs (Phase 5)
- Both connect to same Redis instance but serve different purposes
- Queue configuration includes retry logic and job retention
- Singleton pattern ensures single queue instance throughout app

### Fastify Plugin

**File:** `src/shared/plugins/queue.plugin.ts`

Decorate Fastify instance with:
```typescript
fastify.queue = {
  addWebhookJob: async (webhookId, eventId, eventType) => {
    await webhookQueue.add('process-webhook', { webhookId, eventId, eventType }, {
      jobId: eventId, // Use Stripe event ID for deduplication
    });
  }
}
```

Register in `src/app.ts` after database plugin.

---

## Phase 4: Webhook Endpoint

### Route Handler

**File:** `src/modules/billing/routes/webhooks/stripe.post.ts`

**Critical Configuration:**
```typescript
config: {
  rawBody: true  // MUST have raw body for signature verification
}
```

**Flow:**
1. Extract `stripe-signature` header (validate exists)
2. Verify signature using `stripe.webhooks.constructEvent(rawBody, signature, secret)`
3. Check idempotency: `webhookRepository.existsByStripeEventId(event.id)`
4. If duplicate, return `{ received: true, duplicate: true }`
5. Save to database: `webhookRepository.create(event)`
6. Queue job: `fastify.queue.addWebhookJob(webhook.id, event.id, event.type)`
7. Return `{ received: true }` with 200 status

**Error Handling:**
- Signature verification fails → Return 400
- Any other error → Log but still return 200 (webhook saved, will retry)

**Target Response Time:** <100ms

### Route Configuration

**File:** `src/modules/billing/routes/webhooks/routes.config.ts`

```typescript
export default {
  '/stripe': {
    POST: {
      protected: false, // Public endpoint
      rateLimit: { max: 100, timeWindow: '1 minute' }
    }
  }
}
```

---

## Phase 5: Worker Process

### Worker Implementation

**File:** `src/workers/webhook.worker.ts`

Create BullMQ Worker that consumes jobs from the queue:

```typescript
import { Worker } from 'bullmq';
import { redisConnection } from '@/shared/queue/redis.client';
import { QUEUE_NAMES, JOB_NAMES } from '@/shared/queue/queue.config';

const worker = new Worker(
  QUEUE_NAMES.STRIPE_WEBHOOKS,  // Listen to this queue
  async (job) => {
    // Job processing logic here
    const { webhookId, eventId, eventType } = job.data;
    // ... process webhook ...
  },
  {
    connection: redisConnection,
    concurrency: Number(process.env.WEBHOOK_WORKER_CONCURRENCY) || 5,
  }
);
```

**Key Points:**
- `Worker` class CONSUMES jobs (different from `Queue` which ADDS jobs)
- Both use same Redis connection
- Concurrency controls parallel job processing
- Worker runs as separate Node.js process

**Job Processing Logic:**
1. Extract `webhookId` from job data
2. Fetch webhook from database: `webhookRepository.findById(webhookId)`
3. Check if already processed (skip if yes)
4. Call `webhookProcessor.process(webhook)`
5. Mark as processed: `webhookRepository.markProcessed(webhookId)`
6. On error: Mark failed and re-throw (BullMQ will auto-retry)

**Event Listeners:**
- `completed` → Log success
- `failed` → Log error
- `error` → Log worker error

**Graceful Shutdown:**
Handle SIGINT/SIGTERM to close worker and Redis connection cleanly.

### Package.json Scripts

Add:
```json
{
  "worker": "tsx src/workers/webhook.worker.ts",
  "worker:dev": "tsx --watch src/workers/webhook.worker.ts"
}
```

---

## Phase 6: Webhook Processing Logic

### Processor Service

**File:** `src/modules/billing/services/webhook-processor.service.ts`

Main entry point that routes events to handlers:

```typescript
class WebhookProcessor {
  async process(webhook: WebhookEvent) {
    const event = webhook.payload as Stripe.Event;
    
    switch (event.type) {
      case 'account.updated':
        await accountUpdatedHandler.handle(event);
        break;
      case 'capability.updated':
        await capabilityUpdatedHandler.handle(event);
        break;
      default:
        // Log unhandled event type
    }
  }
}
```

### Event Handlers

Create handler files in `src/modules/billing/handlers/`:

**`account-updated.handler.ts`:**
- Extract account data from event
- Update `stripe_connected_accounts` table:
  - `charges_enabled`
  - `payouts_enabled`
  - `details_submitted`
  - `requirements` (JSONB)
  - `capabilities` (JSONB)
  - `updated_at`
- Log success

**`capability-updated.handler.ts`:**
- Extract capability data from event
- Find connected account by `account_id`
- Update capabilities JSONB field
- Log success

**Handler Pattern:**
Each handler should:
- Have a `handle(event: Stripe.Event)` method
- Extract typed data from event
- Update database
- Log actions
- Be idempotent (safe to run multiple times)

---

## Phase 7: Monitoring (Optional)

### Bull Board Setup

**File:** `src/shared/queue/bull-board.ts`

Install:
```bash
pnpm add @bull-board/api @bull-board/fastify @bull-board/ui
```

Setup Bull Board and register with Fastify at `/admin/queues`.

**Only enable in development** (check `NODE_ENV`).

Access: http://localhost:3000/admin/queues

**Features:**
- View all jobs (waiting, active, completed, failed)
- Retry failed jobs manually
- Monitor queue metrics
- Clean old jobs

---

## Phase 8: Testing

### Local Testing Setup

**1. Start Redis:**
```bash
docker run -p 6379:6379 redis:alpine
```

**2. Start API Server:**
```bash
pnpm run dev
```

**3. Start Worker (separate terminal):**
```bash
pnpm run worker:dev
```

**4. Forward Stripe Webhooks:**
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3000/api/billing/webhooks/stripe

# Copy the webhook secret to .env
```

**5. Trigger Test Events:**
```bash
stripe trigger account.updated
stripe trigger capability.updated
```

**6. Verify:**
- Check API logs: "Webhook received"
- Check database: `SELECT * FROM webhook_events`
- Check worker logs: "Processing webhook"
- Check Bull Board: http://localhost:3000/admin/queues

### Test Checklist

- [ ] Webhook endpoint responds 200 OK in <100ms
- [ ] Duplicate webhooks return `duplicate: true`
- [ ] Webhooks saved to database before queueing
- [ ] Jobs appear in Redis queue
- [ ] Worker processes jobs successfully
- [ ] Database updated correctly
- [ ] Failed jobs retry automatically
- [ ] Bull Board shows queue stats

---

## Phase 9: Production Deployment

### Process Management (PM2)

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [
    {
      name: 'blawby-api',
      script: 'pnpm',
      args: 'run start',
      instances: 2,
      exec_mode: 'cluster',
    },
    {
      name: 'blawby-worker',
      script: 'pnpm',
      args: 'run worker',
      instances: 3,
      exec_mode: 'fork',
    },
  ],
};
```

**Commands:**
```bash
pm2 start ecosystem.config.js
pm2 monit
pm2 logs blawby-worker
```

### Stripe Webhook Configuration

1. Stripe Dashboard → Webhooks
2. Add endpoint: `https://yourdomain.com/api/billing/webhooks/stripe`
3. Select events:
   - `account.updated`
   - `account.external_account.created`
   - `account.external_account.updated`
   - `capability.updated`
4. Copy webhook secret to production `.env`

### Health Check

Add to health endpoint:
- Redis connection status
- Unprocessed webhook count
- Return `degraded` if >1000 unprocessed

Alert if:
- Redis disconnected
- Unprocessed webhooks >1000
- Worker process crashed

---

## Key Implementation Notes

### Critical Requirements

1. **Raw Body for Signature Verification**
   - Must have `rawBody: true` in route config
   - Cannot use parsed JSON body for verification

2. **Idempotency is Essential**
   - Check `stripe_event_id` before saving
   - Use UNIQUE constraint on database
   - Use Stripe event ID as job ID in queue

3. **Always Return 200 OK**
   - Even on errors (prevents Stripe retries)
   - Only return 400 if signature invalid

4. **Save Before Queue**
   - Webhook must persist to DB before queueing
   - Guarantees no data loss

5. **Separate Worker Process**
   - Worker MUST be separate from API server
   - Can scale workers independently

### Common Pitfalls to Avoid

❌ **Don't:**
- Process webhooks synchronously in endpoint
- Use parsed JSON for signature verification
- Queue before saving to database
- Lose raw body in middleware
- Return errors to Stripe (causes retries)

✅ **Do:**
- Save webhook immediately
- Check idempotency first
- Use raw body for verification
- Return 200 quickly (<100ms)
- Process asynchronously in worker

---

## File Structure Summary

```
src/
├── modules/billing/
│   ├── routes/
│   │   └── webhooks/
│   │       ├── stripe.post.ts           # Webhook endpoint
│   │       └── routes.config.ts         # Route config
│   ├── repositories/
│   │   └── webhook.repository.ts        # Database operations
│   ├── schemas/
│   │   └── webhook.schema.ts            # Drizzle schema
│   ├── services/
│   │   └── webhook-processor.service.ts # Processing logic
│   └── handlers/
│       ├── account-updated.handler.ts   # Event handler
│       └── capability-updated.handler.ts # Event handler
├── shared/
│   ├── queue/
│   │   ├── redis.client.ts              # Redis connection
│   │   ├── queue.config.ts              # Queue configuration
│   │   ├── queue.manager.ts             # Queue manager
│   │   └── bull-board.ts                # Monitoring UI
│   └── plugins/
│       └── queue.plugin.ts              # Fastify plugin
└── workers/
    └── webhook.worker.ts                # Worker process

database/migrations/
└── YYYY_MM_DD_create_webhook_events.sql # Migration
```

---

## Scaling Strategy

### Current (MVP)
- Single API server
- Single worker process
- Single Redis instance

### Medium Scale (1000+ webhooks/day)
- 2-3 API servers (load balanced)
- 3-5 worker processes
- Redis with persistence

### Large Scale (10,000+ webhooks/day)
- Multiple API servers
- 10+ worker processes on separate servers
- Redis cluster for HA
- Dead letter queue for failed jobs
- Webhook replay system

---

## Success Criteria

✅ **Implementation Complete When:**
- [ ] Webhooks save to database before queueing
- [ ] Idempotency prevents duplicate processing
- [ ] Response time <100ms
- [ ] Worker processes jobs asynchronously
- [ ] Failed jobs retry automatically
- [ ] Bull Board shows queue metrics
- [ ] All tests pass
- [ ] Documentation updated

✅ **Production Ready When:**
- [ ] Redis configured with persistence
- [ ] Worker process under PM2
- [ ] Health checks implemented
- [ ] Alerts configured
- [ ] Stripe webhook endpoint registered
- [ ] Tested with real Stripe events

---

## Resources

- **BullMQ Docs:** https://docs.bullmq.io/
- **Stripe Webhooks:** https://stripe.com/docs/webhooks
- **Bull Board:** https://github.com/felixmosh/bull-board
- **Stripe CLI:** https://stripe.com/docs/stripe-cli

---

## Support

For questions or issues during implementation:
1. Check BullMQ documentation
2. Review Stripe webhook best practices
3. Test with Stripe CLI before production
4. Monitor Bull Board for queue health