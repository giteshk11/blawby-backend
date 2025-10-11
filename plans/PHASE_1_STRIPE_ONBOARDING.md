# Phase 1: Stripe Connected Account Onboarding

## Goal
Enable organizations to onboard to Stripe Connect using embedded AccountSession components, with async webhook processing.

---

## Architecture Flow

```
1. Frontend → POST /api/onboarding/connected-accounts
2. Backend → Create Stripe account + return client_secret
3. Frontend → Render Stripe embedded component with client_secret
4. User → Completes onboarding in Stripe UI
5. Stripe → Sends account.updated webhook
6. Backend → Store webhook event in DB
7. Job Queue → Process webhook asynchronously
8. Backend → Update account status in DB
```

---

## Database Schema

### Table 1: connected_accounts

**Purpose**: Store Stripe connected account information

**Columns**:
- `id` (uuid, primary key)
- `organization_id` (text, foreign key to Better Auth organizations, cascade delete)
- `stripe_account_id` (text, unique, indexed)
- `account_type` (text, default 'custom')
- `country` (text, default 'US')
- `email` (text, not null)
- `charges_enabled` (boolean, default false)
- `payouts_enabled` (boolean, default false)
- `details_submitted` (boolean, default false)
- `business_type` (text, nullable) // 'individual', 'company', 'non_profit'
- `company` (jsonb, nullable) // Typed as CompanyInfo
- `individual` (jsonb, nullable) // Typed as IndividualInfo
- `requirements` (jsonb, nullable) // Typed as Requirements
- `capabilities` (jsonb, nullable) // Typed as Capabilities
- `external_accounts` (jsonb, nullable) // Typed as ExternalAccounts
- `metadata` (jsonb, nullable)
- `onboarding_completed_at` (timestamp, nullable)
- `last_refreshed_at` (timestamp, nullable)
- `created_at` (timestamp, not null, default now)
- `updated_at` (timestamp, not null, default now)

**Indexes**:
- `organization_id` (for lookups by org)
- `stripe_account_id` (for webhook lookups)
- Composite on `charges_enabled, payouts_enabled` (for status checks)

**TypeScript Types for JSON fields**:
```typescript
interface CompanyInfo {
  name?: string;
  tax_id?: string;
  address?: Address;
}

interface IndividualInfo {
  first_name?: string;
  last_name?: string;
  email?: string;
  dob?: { day?: number; month?: number; year?: number };
  ssn_last_4?: string;
  address?: Address;
}

interface Requirements {
  currently_due: string[];
  eventually_due: string[];
  past_due: string[];
  pending_verification: string[];
  current_deadline?: number | null;
  disabled_reason?: string | null;
}

interface Capabilities {
  card_payments?: string;
  transfers?: string;
  us_bank_account_ach_payments?: string;
}

interface ExternalAccounts {
  object: 'list';
  data: ExternalAccount[];
}
```

### Table 2: webhook_events

**Purpose**: Store all Stripe webhook events for idempotency, retry logic, and debugging

**Columns**:
- `id` (uuid, primary key)
- `stripe_event_id` (text, unique, indexed) // Stripe's event ID
- `event_type` (text, not null, indexed) // 'account.updated', etc.
- `processed` (boolean, default false, indexed)
- `processed_at` (timestamp, nullable)
- `error` (text, nullable) // Error message if processing failed
- `error_stack` (text, nullable) // Full error stack trace
- `retry_count` (integer, default 0)
- `max_retries` (integer, default 3)
- `next_retry_at` (timestamp, nullable, indexed) // When to retry next
- `payload` (jsonb, not null) // Full Stripe event object
- `headers` (jsonb, nullable) // Request headers
- `url` (text, nullable) // Webhook URL
- `created_at` (timestamp, not null, default now)

**Indexes**:
- `stripe_event_id` (for idempotency checks)
- `event_type` (for filtering by event type)
- `processed` (for finding unprocessed events)
- `next_retry_at` (for retry job queries)

---

## Repository Layer

### ConnectedAccountsRepository

**Methods**:
- `findByOrganization(orgId)` - Get account for org
- `findByStripeId(stripeAccountId)` - Get account by Stripe ID
- `findById(id)` - Get account by internal ID
- `create(data)` - Create new account
- `update(id, data)` - Update account by internal ID
- `updateByStripeId(stripeAccountId, data)` - Update by Stripe ID
- `updateLastRefreshed(stripeAccountId)` - Update refresh timestamp

### WebhookEventsRepository

**Methods**:
- `findByStripeEventId(eventId)` - Check if event already received
- `create(data)` - Store new webhook event
- `markProcessed(id)` - Mark event as successfully processed
- `markFailed(id, error)` - Increment retry count, set next retry time
- `getEventsToRetry()` - Get events ready for retry (processed=false, next_retry_at <= now)

**Retry Logic**:
- Exponential backoff: 1min, 5min, 15min
- Max 3 retries
- Calculate next_retry_at based on retry_count

---

## Service Layer

### StripeClientService

**Purpose**: Wrapper around Stripe SDK

**Configuration**:
- API version: '2024-12-18.acacia'
- Uses STRIPE_SECRET_KEY from env

**Methods**:
- `get client()` - Return Stripe instance
- `get accounts()` - Access accounts API
- `get accountSessions()` - Access account sessions API
- `constructWebhookEvent(payload, signature, secret)` - Verify webhook

### ConnectedAccountsService

**Methods**:

1. `createOrGetAccount(organizationId, email)`
   - Check if account exists for org
   - If exists: Generate new account session, return existing account + client_secret
   - If not: Create Stripe account → Save to DB → Generate session → Return
   - Stripe account config:
     - type: 'custom'
     - country: 'US'
     - capabilities: card_payments, transfers, us_bank_account_ach_payments
     - controller: fees payer='application', stripe_dashboard type='none'

2. `createOnboardingSession(stripeAccountId)`
   - Create Stripe AccountSession with account_onboarding component
   - Update last_refreshed_at timestamp
   - Return { clientSecret, expiresAt }

3. `createPaymentsSession(stripeAccountId)` (for Phase 2)
   - Create AccountSession with payments component
   - Enable: refund_management, dispute_management, capture_payments
   - Return { clientSecret, expiresAt }

4. `getAccount(organizationId)`
   - Return account for organization

5. `isAccountActive(account)`
   - Check: charges_enabled AND payouts_enabled
   - Check: requirements (currently_due, eventually_due, past_due all empty)
   - Return boolean

6. `handleAccountUpdated(stripeAccountId, accountData)`
   - Find account by stripe_account_id
   - Update: charges_enabled, payouts_enabled, details_submitted, requirements, capabilities, external_accounts, company, individual
   - If details_submitted AND onboarding_completed_at is null:
     - Set onboarding_completed_at = now
     - Log completion
     - TODO: Trigger events (Phase 2)

### WebhooksService

**Methods**:

1. `verifyAndStore(rawBody, signature, headers, url)`
   - Get STRIPE_WEBHOOK_SECRET from env
   - Verify signature using Stripe SDK
   - If invalid: throw 'Invalid signature'
   - Check if event already exists by stripe_event_id (idempotency)
   - If exists: return { event, alreadyProcessed: true }
   - Store in webhook_events table
   - Return { event, alreadyProcessed: false }

2. `processEvent(eventId)`
   - Get webhook event by stripe_event_id
   - If already processed: return
   - Try processing:
     - Switch on event.type:
       - 'account.updated': Call handleAccountUpdated
       - Default: Log unhandled event
     - Mark as processed
     - Log success
   - Catch errors:
     - Mark as failed (increments retry_count, sets next_retry_at)
     - Re-throw error

3. `retryFailedWebhooks()` (for cron job)
   - Get events to retry from repository
   - For each: call processEvent(eventId)
   - Catch and log errors

---

## Routes

### POST /api/onboarding/connected-accounts

**Purpose**: Create or get connected account

**Auth**: Required (protected)

**Body Schema**:
```typescript
{
  email: string (email format),
  country?: string (2 chars, default 'US')
}
```

**Logic**:
- Get organizationId from request.user.organization.id
- Call connectedAccountsService.createOrGetAccount(orgId, email)
- Return:
```typescript
{
  accountId: string,
  clientSecret: string,
  expiresAt: number,
  status: {
    chargesEnabled: boolean,
    payoutsEnabled: boolean,
    detailsSubmitted: boolean
  }
}
```

### GET /api/onboarding/connected-accounts

**Purpose**: Get connected account status

**Auth**: Required (protected)

**Logic**:
- Get organizationId from request.user
- Call connectedAccountsService.getAccount(orgId)
- If not found: 404
- Check if active with isAccountActive()
- Return:
```typescript
{
  accountId: string,
  status: {
    chargesEnabled: boolean,
    payoutsEnabled: boolean,
    detailsSubmitted: boolean,
    isActive: boolean
  },
  requirements: Requirements,
  onboardingCompletedAt: timestamp | null
}
```

### POST /api/onboarding/connected-accounts/session

**Purpose**: Refresh expired onboarding link

**Auth**: Required (protected)

**Logic**:
- Get organizationId from request.user
- Get account for org
- If not found: 404
- Create new onboarding session
- Return:
```typescript
{
  clientSecret: string,
  expiresAt: number
}
```

### POST /api/onboarding/webhooks/stripe

**Purpose**: Receive Stripe webhooks

**Auth**: Public (verifies via signature)

**Logic**:
- Get stripe-signature header
- If missing: 400 error
- Call webhooksService.verifyAndStore(rawBody, signature, headers, url)
- If verification fails: 400 error
- If alreadyProcessed: return { received: true, alreadyProcessed: true }
- Queue for async processing:
  - For now: use setImmediate(() => webhooksService.processEvent(eventId))
  - TODO Phase 2: Use real job queue (BullMQ, etc.)
- Return { received: true }

**IMPORTANT**: Need raw body for signature verification, not parsed JSON

### routes.config.ts

```typescript
{
  protected: true,
  public: ['POST /webhooks/stripe']
}
```

---

## Frontend Integration Guide

**Step 1: Create account**
```typescript
const response = await fetch('/api/onboarding/connected-accounts', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ email: 'practice@example.com' })
});

const { clientSecret, accountId } = await response.json();
```

**Step 2: Render Stripe component**
```typescript
import { loadConnectAndInitialize } from '@stripe/connect-js';

const stripeConnect = loadConnectAndInitialize({
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  fetchClientSecret: async () => clientSecret,
});

const onboarding = stripeConnect.create('account-onboarding');
onboarding.mount('#onboarding-container');
```

**Step 3: Handle completion**
- Stripe will send webhook when onboarding completes
- Poll GET /api/onboarding/connected-accounts to check status
- When status.detailsSubmitted === true, onboarding complete

---

## Environment Variables

```env
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: For production
STRIPE_WEBHOOK_SECRET_CONNECT=whsec_... # Separate for connect webhooks
```

---

## Testing

### Local Webhook Testing

Use Stripe CLI:
```bash
# Install Stripe CLI
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/onboarding/webhooks/stripe

# Trigger test events
stripe trigger account.updated
```

### Test Flow

1. **Create account**: `POST /api/onboarding/connected-accounts` with email
2. **Get client_secret**: Use in frontend component
3. **Complete onboarding**: Use Stripe test data
4. **Verify webhook**: Check webhook_events table
5. **Check status**: `GET /api/onboarding/connected-accounts` should show active

### Stripe Test Data

For testing onboarding:
- Business name: "Test Business"
- EIN: 00-0000000
- Address: Any US address
- Phone: Any US phone
- Bank routing: 110000000
- Bank account: 000123456789

---

## Job Queue Implementation (Phase 2)

Current: Using `setImmediate()` for async processing

**Future with BullMQ**:
1. Install: `pnpm add bullmq ioredis`
2. Create queue: `stripe-webhooks`
3. In webhook handler: Add job to queue instead of setImmediate
4. Create worker: Process jobs from queue
5. Add retry/backoff config
6. Add job dashboard (Bull Board)

**Worker pseudocode**:
```typescript
// Worker processes jobs
worker.on('completed', (job) => {
  // Mark webhook as processed
});

worker.on('failed', (job, error) => {
  // Mark webhook as failed, schedule retry
});
```

---

## Cron Job for Retry

**Purpose**: Retry failed webhooks

**Schedule**: Every 5 minutes

**Logic**:
- Call webhooksService.retryFailedWebhooks()
- Processes events where processed=false AND next_retry_at <= now
- Max 3 retries with exponential backoff

**Implementation options**:
- node-cron
- bull-scheduler
- External cron (Render, Railway cron)

---

## Success Criteria

- [ ] Database tables created with migrations
- [ ] Can create connected account via API
- [ ] Client receives valid client_secret
- [ ] Frontend can render Stripe component
- [ ] Webhooks are received and stored
- [ ] Webhooks are processed asynchronously
- [ ] Account status updates after onboarding
- [ ] Failed webhooks retry automatically
- [ ] Can check account status via API

---

## Module Structure

```
modules/onboarding/
├── routes.config.ts
├── routes/
│   ├── connected-accounts/
│   │   ├── index.get.ts
│   │   ├── index.post.ts
│   │   └── session.post.ts
│   └── webhooks/
│       └── stripe.post.ts
├── services/
│   ├── stripe-client.ts
│   ├── connected-accounts.service.ts
│   └── webhooks.service.ts
├── repositories/
│   ├── connected-accounts.repository.ts
│   └── webhook-events.repository.ts
└── schemas/
    ├── connected-accounts.schema.ts
    └── webhook-events.schema.ts
```

---

## Notes for Cursor

- Use Drizzle ORM with typed jsonb fields
- Use Zod for validation schemas
- Export singleton instances for services/repositories
- Follow existing patterns in codebase
- Use Better Auth organization.id, not team_id
- Raw body needed for webhook signature verification
- Account status logic: charges_enabled AND payouts_enabled AND requirements empty
- Stripe API version: '2024-12-18.acacia'
- Controller config ensures platform controls fees
- AccountSession expires, need to refresh link if expired