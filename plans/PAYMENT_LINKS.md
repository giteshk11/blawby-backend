# Blawby Payment Infrastructure Analysis & Improvements

## 🔍 Current Architecture Overview

### **Payment System Components**

#### 1. **Platform Billing (Subscription Payments)**

- **Purpose**: Collect subscription fees from law practices for using Blawby platform
- **Location**: `/src/modules/subscriptions/`
- **Stripe Account**: Platform's main Stripe account
- **Customer**: `organizations.stripeCustomerId` (platform customer)
- **Key Files**:
  - `api/setup-payment.post.ts` - Setup payment method collection
  - `services/payment-setup.service.ts` - Platform customer & SetupIntent creation
  - `handlers/invoice-payment-succeeded.handler.ts` - Handle subscription payments

#### 2. **Connected Accounts (Practice Payments)**

- **Purpose**: Enable law practices to accept payments from their clients
- **Location**: `/src/modules/onboarding/`, `/src/modules/payments/`
- **Stripe Account**: Each practice's connected Stripe account
- **Customer**: Practice's clients
- **Key Files**:
  - `onboarding/services/connected-accounts.service.ts` - Account creation
  - `stripe/routes/connected-accounts/payments-session.post.ts` - Payment UI session
  - `payments/handlers/charge-succeeded.handler.ts` - Handle practice payments

#### 3. **Webhook Processing**

- **Location**: `/src/modules/stripe/routes/webhooks/`, `/src/workers/webhook.worker.ts`
- **Key Components**:
  - Webhook route (signature verification + storage)
  - BullMQ queue for async processing
  - Dedicated worker process

---

## ✅ What's Working Well

### **1. Separation of Concerns**

- Platform billing (subscriptions) is cleanly separated from practice payments (connected accounts)
- Different Stripe customers for different purposes

### **2. Idempotency**

- Webhook events stored with `stripeEventId` unique constraint
- Prevents duplicate processing

### **3. Worker Architecture**

- Dedicated worker process (`webhook.worker.ts`)
- BullMQ with Redis for reliable queue processing
- Proper retry mechanism and error handling

### **4. Database Design**

```sql
-- Platform billing
organizations.stripeCustomerId         -- Platform customer
organizations.stripePaymentMethodId    -- Default payment method
organizations.activeSubscriptionId     -- Current subscription

-- Connected accounts
stripe_connected_accounts.stripeAccountId  -- Practice's Stripe account
stripe_connected_accounts.chargesEnabled   -- Can accept payments
stripe_connected_accounts.payoutsEnabled   -- Can receive payouts

-- Subscriptions
subscriptions.stripeSubscriptionId     -- Stripe subscription
subscriptions.status                   -- active, past_due, canceled
subscriptions.currentPeriodEnd         -- Billing cycle end date
```

---

## 🚨 Critical Issues & Fixes

### **Issue 1: Missing API for Practice Payment Setup**

#### **Problem**

There's NO dedicated API endpoint for practices to set up their connected account after organization creation. The frontend needs to call:

1. Create connected account (onboarding)
2. Get account session for embedded UI

#### **Solution**

Create a unified endpoint for practice payment setup:

```typescript
// src/modules/onboarding/api/setup-practice-payments.post.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { createOrGetAccount } from '../services/connected-accounts.service';

/**
 * Setup practice payment account (Connected Account)
 * POST /api/onboarding/setup-practice-payments
 *
 * This should be called after organization creation
 */
export default async function setupPracticePaymentsRoute(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    const organizationId = request.activeOrganizationId;

    if (!organizationId) {
      return reply.unauthorized('Organization ID is required');
    }

    // Get user email for Stripe account
    const userId = request.user?.id;
    if (!userId) {
      return reply.unauthorized('User authentication required');
    }

    const user = await request.server.db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
    });

    if (!user?.email) {
      return reply.badRequest('User email is required');
    }

    // Create or get connected account + generate session
    const result = await createOrGetAccount(
      request.server,
      organizationId,
      user.email,
    );

    return reply.send({
      success: true,
      data: {
        accountId: result.accountId,
        clientSecret: result.clientSecret,
        expiresAt: result.expiresAt,
        status: result.status,
        sessionStatus: result.sessionStatus,
      },
    });
  } catch (error) {
    request.server.logError(error, request);
    return reply.internalServerError('Failed to setup practice payments');
  }
}
```

#### **Frontend Integration Flow**

```typescript
// After organization creation
const setupPracticePayments = async () => {
  // 1. Setup connected account for practice payments
  const { data: practiceAccount } = await api.post(
    '/api/onboarding/setup-practice-payments',
  );

  // 2. Render Stripe Connect embedded component
  const accountSession = stripe.createAccountSession({
    clientSecret: practiceAccount.clientSecret,
  });

  // 3. Setup platform billing (subscription)
  const { data: billing } = await api.post('/api/subscriptions/setup-payment', {
    email: user.email,
    name: org.name,
  });

  // 4. Render Stripe Elements for payment method
  const elements = stripe.elements({
    clientSecret: billing.clientSecret,
  });
};
```

---

### **Issue 2: Webhook Fire-and-Forget Not Implemented**

#### **Problem in Current Code**

```typescript
// src/modules/stripe/routes/webhooks/index.post.ts
// ❌ Uses queue (good) but AWAITS it (blocks response)
if (request.server.queue) {
  await request.server.queue.addWebhookJob(
    // ❌ BLOCKING
    webhookEvent.id,
    event.id,
    event.type,
  );
}
return reply.send({ received: true }); // Only after queue.add completes
```

#### **Fix: True Fire-and-Forget**

```typescript
// src/modules/stripe/routes/webhooks/index.post.ts
export default async function webhookRoute(
  request: WebhookRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const signature = request.headers['stripe-signature'];
  const rawBody = request.rawBody;

  if (!signature || !rawBody) {
    return reply.badRequest('Missing stripe-signature header or raw body');
  }

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
    }

    // 1. Verify signature (fast, synchronous)
    const event = getStripeClient().webhooks.constructEvent(
      rawBody as string | Buffer,
      signature as string,
      webhookSecret,
    );

    // 2. Check idempotency (fast, single query)
    const alreadyExists = await existsByStripeEventId(
      request.server.db,
      event.id,
    );

    if (alreadyExists) {
      return reply.send({ received: true, duplicate: true });
    }

    // 3. Store webhook (fast, single insert)
    const webhookEvent = await createStripeWebhookEvent(
      request.server.db,
      event,
      request.headers as Record<string, string>,
      request.url,
    );

    // 4. ✅ Queue job WITHOUT awaiting (fire-and-forget)
    if (request.server.queue) {
      request.server.queue
        .addWebhookJob(webhookEvent.id, event.id, event.type)
        .catch((err) => {
          request.server.log.error(
            { err, eventId: event.id },
            'Failed to queue webhook job',
          );
        });
    } else {
      // Fallback: process async with setImmediate
      setImmediate(async () => {
        try {
          await processEvent(request.server, event.id);
        } catch (err) {
          request.server.log.error(
            { err, eventId: event.id },
            'Async webhook processing failed',
          );
        }
      });
    }

    // 5. ✅ Reply immediately (within 3 seconds)
    return reply.send({ received: true });
  } catch (error) {
    request.server.log.error(
      { error, signature: signature?.substring(0, 20) },
      'Webhook verification failed',
    );

    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return reply.badRequest('Invalid signature');
    }

    // Return 200 for non-signature errors to prevent Stripe retries
    return reply.send({ received: true });
  }
}
```

#### **Key Changes**

1. ✅ Removed `await` from `queue.addWebhookJob()`
2. ✅ Added `.catch()` for unhandled promise rejections
3. ✅ Response sent immediately after storing webhook
4. ✅ Fallback to `setImmediate` if queue unavailable

---

### **Issue 3: Missing charge.succeeded Handler in Webhook Processor**

#### **Problem**

```typescript
// src/modules/onboarding/services/webhooks.service.ts
export const processEvent = async (
  fastify: FastifyInstance,
  eventId: string,
): Promise<void> => {
  // ...
  switch (event.type) {
    case 'account.updated':
      await handleAccountUpdatedWebhook(fastify, event);
      break;

    case 'charge.succeeded':
      await handleChargeSucceededWebhook(fastify, event);
      break; // ✅ Already wired up!

    // Missing: invoice.payment_succeeded handler

    default:
      fastify.log.info(`Unhandled webhook event type: ${event.type}`);
  }
};
```

#### **Fix: Add Invoice Payment Handler**

```typescript
// src/modules/onboarding/services/webhooks.service.ts
import { handleInvoicePaymentSucceeded } from '@/modules/subscriptions/handlers/invoice-payment-succeeded.handler';

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

    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdatedWebhook(fastify, event);
        break;

      case 'charge.succeeded':
        await handleChargeSucceededWebhook(fastify, event);
        break;

      // ✅ ADD THIS - Platform billing
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceededWebhook(fastify, event);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailedWebhook(fastify, event);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdatedWebhook(fastify, event);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeletedWebhook(fastify, event);
        break;

      case 'capability.updated':
        await handleCapabilityUpdatedWebhook(fastify, event);
        break;

      default:
        fastify.log.info(
          { eventType: event.type },
          'Unhandled webhook event type - consider adding handler',
        );
    }

    await markWebhookProcessed(fastify.db, webhookEvent.id);
    fastify.log.info(`Successfully processed webhook event: ${eventId}`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    await markWebhookFailed(
      fastify.db,
      webhookEvent.id,
      errorMessage,
      errorStack,
    );

    fastify.log.error(
      { eventId, error: errorMessage, stack: errorStack },
      'Failed to process webhook event',
    );

    throw error;
  }
};

// ✅ Add handler wrapper
const handleInvoicePaymentSucceededWebhook = async (
  fastify: FastifyInstance,
  event: Stripe.Event,
): Promise<void> => {
  const baseEvent = {
    eventId: event.id,
    eventType: event.type,
    eventVersion: '1.0.0',
    timestamp: new Date(),
    actorId: 'stripe',
    actorType: 'webhook' as const,
    organizationId: undefined,
    payload: event.data.object as Record<string, unknown>,
    metadata: {
      source: 'webhook',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    },
    processed: false,
    retryCount: 0,
  };

  await handleInvoicePaymentSucceeded(fastify, baseEvent);
};

const handleInvoicePaymentFailedWebhook = async (
  fastify: FastifyInstance,
  event: Stripe.Event,
): Promise<void> => {
  // Import and call handler
  const { handleInvoicePaymentFailed } = await import(
    '@/modules/subscriptions/handlers/invoice-payment-failed.handler'
  );

  const baseEvent = {
    eventId: event.id,
    eventType: event.type,
    eventVersion: '1.0.0',
    timestamp: new Date(),
    actorId: 'stripe',
    actorType: 'webhook' as const,
    organizationId: undefined,
    payload: event.data.object as Record<string, unknown>,
    metadata: {
      source: 'webhook',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    },
    processed: false,
    retryCount: 0,
  };

  await handleInvoicePaymentFailed(fastify, baseEvent);
};
```

---

## 🎯 Recommended Implementation Plan

### **Phase 1: Quick Wins (Immediate)**

#### **1.1 Fix Webhook Fire-and-Forget** ⚡

**Time**: 15 minutes  
**Files**: `src/modules/stripe/routes/webhooks/index.post.ts`

```typescript
// Remove await from queue.addWebhookJob()
request.server.queue
  .addWebhookJob(webhookEvent.id, event.id, event.type)
  .catch((err) => {
    request.server.log.error({ err }, 'Failed to queue webhook');
  });

return reply.send({ received: true }); // Immediate response
```

#### **1.2 Add Missing Webhook Handlers** ⚡

**Time**: 30 minutes  
**Files**: `src/modules/onboarding/services/webhooks.service.ts`

Add handlers for:

- `invoice.payment_succeeded` (platform billing)
- `invoice.payment_failed` (handle failed payments)
- `customer.subscription.updated` (sync subscription status)
- `customer.subscription.deleted` (handle cancellations)

#### **1.3 Create Practice Payment Setup API** ⚡

**Time**: 45 minutes  
**Files**: `src/modules/onboarding/api/setup-practice-payments.post.ts`

Single endpoint for frontend to:

1. Create/get connected account
2. Generate embedded onboarding session
3. Return status + client secret

---

### **Phase 2: Enhancements (Next Sprint)**

#### **2.1 Monitoring & Observability**

```typescript
// Add timing metrics
const startTime = Date.now();
const event = getStripeClient().webhooks.constructEvent(...);
const verifyDuration = Date.now() - startTime;

if (verifyDuration > 2000) {
  request.server.log.warn(
    { duration: verifyDuration },
    'Slow webhook verification - approaching Stripe timeout',
  );
}

// Add event type logging
request.server.log.info(
  {
    eventType: event.type,
    eventId: event.id,
    duplicate: alreadyExists,
    duration: verifyDuration,
  },
  'Webhook received',
);
```

#### **2.2 Dead Letter Queue**

```typescript
// In webhook.worker.ts
const worker = new Worker(QUEUE_NAMES.STRIPE_WEBHOOKS, processWebhookJob, {
  connection: getRedisConnection(),
  concurrency: 5,

  // ✅ Add DLQ for failed jobs
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },

  // Jobs failed 5 times go to DLQ
  onFailed: async (job, error) => {
    if (job.attemptsMade >= 5) {
      // Move to dead letter queue for manual investigation
      await request.server.queue.addDeadLetterJob({
        originalJob: job.data,
        error: error.message,
        failedAt: new Date(),
      });
    }
  },
});
```

#### **2.3 Webhook Dashboard**

Create admin endpoint to:

- View webhook processing stats
- Retry failed webhooks manually
- See webhook queue depth
- Monitor processing latency

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         BLAWBY PLATFORM                          │
└─────────────────────────────────────────────────────────────────┘

FRONTEND FLOW (After Organization Creation)
├─ Setup Practice Payments (Connected Account)
│  └─ POST /api/onboarding/setup-practice-payments
│     ├─ Creates/gets Stripe Connect account
│     ├─ Returns clientSecret for embedded onboarding
│     └─ Practice can now accept payments from clients
│
└─ Setup Platform Billing (Subscription)
   └─ POST /api/subscriptions/setup-payment
      ├─ Creates platform Stripe customer
      ├─ Returns clientSecret for payment method setup
      └─ Platform can charge practice for subscription

WEBHOOK PROCESSING FLOW
┌─────────────────┐
│  Stripe Webhook │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Webhook Route          │
│  - Verify signature     │  <── 200ms
│  - Store in DB          │
│  - Queue job (no await) │
│  - Reply 200 OK         │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  BullMQ Redis Queue     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Webhook Worker         │
│  - Process event        │  <── Async, retry on failure
│  - Call handlers        │
│  - Mark processed       │
└─────────────────────────┘

TWO PAYMENT FLOWS
├─ Practice Payments (Connected Accounts)
│  ├─ Customer: Practice's clients
│  ├─ Account: stripe_connected_accounts.stripeAccountId
│  └─ Events: charge.succeeded, refund.created
│
└─ Platform Billing (Subscriptions)
   ├─ Customer: organizations.stripeCustomerId
   ├─ Account: Platform's Stripe account
   └─ Events: invoice.payment_succeeded, subscription.updated
```

---

## 🔒 Security Considerations

### **1. Webhook Signature Verification**

✅ Already implemented correctly with Stripe SDK

### **2. Rate Limiting**

⚠️ Consider adding:

```typescript
// Prevent webhook flooding
if (request.server.redis) {
  const key = `webhook:rate:${request.ip}`;
  const count = await request.server.redis.incr(key);

  if (count === 1) {
    await request.server.redis.expire(key, 60); // 1 minute window
  }

  if (count > 100) {
    return reply.tooManyRequests('Webhook rate limit exceeded');
  }
}
```

### **3. Idempotency Keys**

✅ Already using Stripe event IDs as idempotency keys

---

## 🧪 Testing Checklist

```bash
# Test webhook flow with Stripe CLI
stripe listen --forward-to localhost:3000/api/stripe/webhooks

# Trigger events
stripe trigger charge.succeeded --connect-account=acct_xxx
stripe trigger invoice.payment_succeeded
stripe trigger customer.subscription.updated

# Test connected account setup
curl -X POST http://localhost:3000/api/onboarding/setup-practice-payments \
  -H "Authorization: Bearer $TOKEN"

# Test platform billing setup
curl -X POST http://localhost:3000/api/subscriptions/setup-payment \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"email": "test@example.com"}'
```

---

## 📈 Performance Metrics to Monitor

```typescript
// Add to webhook route
{
  webhook_verification_time: number,      // Should be < 100ms
  webhook_storage_time: number,           // Should be < 50ms
  webhook_total_response_time: number,    // Should be < 300ms
  queue_depth: number,                    // Monitor for backlog
  worker_processing_time: number,         // Per handler
  failed_webhook_count: number,           // Monitor spikes
}
```

---

## ✅ Summary of Improvements

### **Immediate (Phase 1)**

1. ✅ Remove `await` from webhook queue.addWebhookJob()
2. ✅ Add `.catch()` handlers for fire-and-forget promises
3. ✅ Wire up missing invoice webhook handlers
4. ✅ Create unified practice payment setup API

### **Short-term (Phase 2)**

5. Add webhook processing metrics
6. Implement dead letter queue
7. Create webhook monitoring dashboard
8. Add rate limiting for webhooks

### **Future Enhancements**

9. Consider replacing `setImmediate` with queue everywhere
10. Add webhook replay functionality
11. Implement webhook event filtering by organization

---

## 🎯 Next Steps

**Recommended Order**:

1. Fix fire-and-forget (15 min) ← **START HERE**
2. Add missing handlers (30 min)
3. Create practice payment API (45 min)
4. Test with Stripe CLI (30 min)
5. Deploy to staging
6. Monitor for 24 hours
7. Roll out Phase 2 improvements

**Total Time**: ~2 hours for Phase 1  
**Impact**: Critical - fixes blocking issues and completes payment flow
