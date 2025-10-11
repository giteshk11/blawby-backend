# Stripe Connected Accounts - Complete Implementation Plan

## Laravel System Analysis ✅

Analyzed Laravel implementation at `/Users/giteshkhurani/Projects/blawby`

---

## Current Laravel Architecture

### Payment Flows

1. **Invoice Payments** (Client → Practice)

   - Create invoice via Stripe API (with `on_behalf_of` connected account)
   - Stripe handles payment collection
   - On `invoice.paid` webhook → Transfer funds to connected account
   - Track in `invoices` + `paid_invoice_payout_transfers` tables
   - Calculate application fee (1.3336% of Stripe fees)
   - Record metered usage for subscription billing

2. **Custom Payments** (Direct payment link)

   - Create payment intent for connected account
   - On `charge.succeeded` → Update status + calculate fee
   - Send receipts to customer & practice
   - Record metered usage

3. **Payouts** (Stripe → Practice bank)
   - Stripe automatically pays out to connected account
   - On `payout.paid` webhook → Record payout + calculate fee
   - Record metered usage

### Key Tables

- `stripe_connected_accounts` - Connected account info
- `invoices` - Invoice tracking
- `invoice_line_items` - Line items
- `paid_invoice_payout_transfers` - Transfer records
- `team_custom_payments` - Direct payments
- `stripe_payouts` - Payout records
- `stripe_usage_events` - Metered billing events
- `track_stripe_subscriptions` - Platform subscription tracking
- `webhook_calls` - Webhook audit log

### Services Architecture

```
StripeConnectedAccountService
├── Create/get connected account
├── Create account sessions (onboarding, payments view)
└── Handle account.updated webhook

StripePaymentService (coordinator)
├── Handle invoice.paid (customer)
├── Handle invoice.paid (team/platform)
├── Handle charge.succeeded (custom payments)
├── Handle payout.paid
└── Handle account.updated

StripeInvoiceService
├── Create invoice on Stripe
├── Store invoice locally
├── Generate invoice numbers
└── Handle payment success/failure

StripeTransfersService
└── Transfer invoice amount to connected account

StripeSubscriptionService
├── Create platform subscription
├── Record usage events (invoices, custom payments, payouts)
└── Handle price updates
```

---

## What Laravel Does Well

### ✅ Strengths

1. **Metered Billing** - Tracks usage for platform subscription
2. **Dual Invoice Types** - Customer invoices vs Platform invoices
3. **Transfer Tracking** - `paid_invoice_payout_transfers` table
4. **Webhook Audit** - Stores all webhooks in `webhook_calls`
5. **Queue Processing** - Async webhook handling via jobs
6. **Application Fee Calculation** - Dynamic fee based on Stripe fees
7. **Receipt Generation** - Separate receipts for customer & practice
8. **Invoice Numbers** - Unique format: `TeamCode-YYYYMMDD-XXX`
9. **Account Sessions** - Embedded onboarding & payments view
10. **Event Dispatching** - Customer status updates on first payment

### ⚠️ Pain Points

1. **Service Coupling** - `StripePaymentService` does too much (coordinator pattern gone wrong)
2. **No Payment Intent Tracking** - Only tracks charges, not the full payment intent lifecycle
3. **Mixed Concerns** - Subscription logic mixed with payment logic
4. **Team vs Organization** - Uses `team_id` but we have Better Auth `organization_id`
5. **Limited Error Handling** - Basic try-catch, no retry logic
6. **No Refund Tracking** - Can't track refunds
7. **No Dispute Tracking** - Can't track chargebacks
8. **No Customer Entity** - Customer model is tied to teams, not flexible
9. **Hardcoded Fees** - Fee percentages in config, not per-organization

---

## Improved TypeScript Architecture

### Module Structure

```
modules/billing/
├── routes.config.ts
├── routes/
│   ├── accounts/
│   │   ├── index.get.ts              # List connected accounts
│   │   ├── index.post.ts             # Create connected account
│   │   ├── [id].get.ts               # Get account details
│   │   ├── [id].patch.ts             # Refresh account from Stripe
│   │   ├── onboarding-session.post.ts
│   │   └── payments-session.post.ts
│   ├── invoices/
│   │   ├── index.get.ts              # List invoices
│   │   ├── index.post.ts             # Create invoice
│   │   ├── [id].get.ts               # Get invoice
│   │   ├── [id]/send.post.ts         # Send invoice
│   │   └── [id]/void.post.ts         # Void invoice
│   ├── payments/
│   │   ├── index.get.ts              # List payment intents
│   │   ├── index.post.ts             # Create payment intent
│   │   ├── [id].get.ts               # Get payment intent
│   │   ├── [id]/confirm.post.ts      # Confirm payment
│   │   └── [id]/refund.post.ts       # Refund payment
│   ├── transfers/
│   │   ├── index.get.ts              # List transfers
│   │   └── [id].get.ts               # Get transfer details
│   ├── payouts/
│   │   ├── index.get.ts              # List payouts
│   │   └── [id].get.ts               # Get payout details
│   ├── customers/
│   │   ├── index.get.ts              # List customers
│   │   ├── index.post.ts             # Create customer
│   │   ├── [id].get.ts               # Get customer
│   │   ├── [id].patch.ts             # Update customer
│   │   └── [id]/payment-methods/
│   │       ├── index.get.ts          # List payment methods
│   │       └── index.post.ts         # Attach payment method
│   └── webhooks/
│       └── stripe.post.ts            # Webhook handler
│
├── services/
│   ├── connected-accounts.service.ts
│   ├── invoices.service.ts
│   ├── payments.service.ts           # Payment intents
│   ├── transfers.service.ts
│   ├── payouts.service.ts
│   ├── customers.service.ts
│   ├── webhooks.service.ts
│   ├── fees.service.ts               # Fee calculation
│   ├── receipts.service.ts           # Receipt generation
│   └── stripe-client.ts
│
├── repositories/
│   ├── connected-accounts.repository.ts
│   ├── invoices.repository.ts
│   ├── invoice-items.repository.ts
│   ├── payment-intents.repository.ts
│   ├── transfers.repository.ts
│   ├── payouts.repository.ts
│   ├── customers.repository.ts
│   └── webhook-events.repository.ts
│
└── schemas/
    ├── connected-accounts.schema.ts
    ├── invoices.schema.ts
    ├── invoice-items.schema.ts
    ├── payment-intents.schema.ts
    ├── transfers.schema.ts
    ├── payouts.schema.ts
    ├── customers.schema.ts
    └── webhook-events.schema.ts
```

---

## Database Schema (PostgreSQL + Drizzle)

### 1. Connected Accounts

```typescript
export const connectedAccounts = pgTable('connected_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),

  // Stripe
  stripeAccountId: text('stripe_account_id').notNull().unique(),
  accountType: text('account_type').notNull(), // 'custom'
  country: text('country').notNull().default('US'),
  email: text('email').notNull(),

  // Status
  chargesEnabled: boolean('charges_enabled').notNull().default(false),
  payoutsEnabled: boolean('payouts_enabled').notNull().default(false),
  detailsSubmitted: boolean('details_submitted').notNull().default(false),

  // Business Info
  businessType: text('business_type'), // 'individual', 'company'

  // JSON Fields (typed)
  company: jsonb('company').$type<CompanyInfo>(),
  individual: jsonb('individual').$type<IndividualInfo>(),
  requirements: jsonb('requirements').$type<Requirements>(),
  capabilities: jsonb('capabilities').$type<Capabilities>(),
  externalAccounts: jsonb('external_accounts').$type<ExternalAccounts>(),
  metadata: jsonb('metadata'),

  // Onboarding
  onboardingCompletedAt: timestamp('onboarding_completed_at'),
  lastRefreshedAt: timestamp('last_refreshed_at'),

  // Platform Subscription (from Laravel)
  platformCustomerId: text('platform_customer_id'), // For platform billing
  platformSubscriptionId: text('platform_subscription_id'),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 2. Invoices (from Laravel)

```typescript
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  connectedAccountId: uuid('connected_account_id')
    .notNull()
    .references(() => connectedAccounts.id),

  // Stripe
  stripeInvoiceId: text('stripe_invoice_id').notNull().unique(),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeChargeId: text('stripe_charge_id'),

  // Invoice Info
  invoiceNumber: text('invoice_number').notNull().unique(), // OrgCode-YYYYMMDD-XXX
  invoiceType: text('invoice_type').notNull(), // 'customer', 'platform'

  // Amounts (in cents)
  amountDue: integer('amount_due').notNull(),
  amountPaid: integer('amount_paid').notNull().default(0),
  amountRemaining: integer('amount_remaining').notNull(),
  currency: text('currency').notNull().default('usd'),

  // Fees (from Laravel)
  applicationFee: integer('application_fee'), // Platform fee
  stripeFee: integer('stripe_fee'), // Stripe's fee
  netAmount: integer('net_amount'), // Amount after fees

  // Status
  status: text('status').notNull(), // 'draft', 'open', 'paid', 'void', 'uncollectible'

  // Dates
  dueDate: timestamp('due_date'),
  paidAt: timestamp('paid_at'),
  voidedAt: timestamp('voided_at'),

  // Receipt
  receiptUrl: text('receipt_url'),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 3. Invoice Line Items (from Laravel)

```typescript
export const invoiceLineItems = pgTable('invoice_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),

  // Item Info
  description: text('description').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: integer('unit_price').notNull(), // in cents
  lineTotal: integer('line_total').notNull(), // in cents

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 4. Payment Intents (NEW - Laravel doesn't track)

```typescript
export const paymentIntents = pgTable('payment_intents', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  connectedAccountId: uuid('connected_account_id')
    .notNull()
    .references(() => connectedAccounts.id),
  customerId: uuid('customer_id').references(() => customers.id),
  invoiceId: uuid('invoice_id').references(() => invoices.id),

  // Stripe
  stripePaymentIntentId: text('stripe_payment_intent_id').notNull().unique(),
  stripeChargeId: text('stripe_charge_id'),

  // Amounts (in cents)
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('usd'),
  applicationFeeAmount: integer('application_fee_amount'),

  // Status
  status: text('status').notNull(),

  // Payment Method
  paymentMethodId: text('payment_method_id'),
  paymentMethodType: text('payment_method_type'),

  // Customer Info (snapshot)
  customerEmail: text('customer_email'),
  customerName: text('customer_name'),

  // Metadata
  metadata: jsonb('metadata').$type<Record<string, any>>(),

  // Receipt
  receiptEmail: text('receipt_email'),
  receiptUrl: text('receipt_url'),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  succeededAt: timestamp('succeeded_at'),
});
```

### 5. Transfers (from Laravel `paid_invoice_payout_transfers`)

```typescript
export const transfers = pgTable('transfers', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  connectedAccountId: uuid('connected_account_id')
    .notNull()
    .references(() => connectedAccounts.id),
  invoiceId: uuid('invoice_id').references(() => invoices.id),

  // Stripe
  stripeTransferId: text('stripe_transfer_id').notNull().unique(),

  // Amounts (in cents)
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('usd'),

  // Status
  status: text('status').notNull(), // 'pending', 'paid', 'failed'

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 6. Payouts (from Laravel)

```typescript
export const payouts = pgTable('payouts', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  connectedAccountId: uuid('connected_account_id')
    .notNull()
    .references(() => connectedAccounts.id),

  // Stripe
  stripePayoutId: text('stripe_payout_id').notNull().unique(),

  // Amounts (in cents)
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('usd'),
  applicationFee: integer('application_fee'), // Platform fee on payout

  // Status
  status: text('status').notNull(),

  // Destination
  destinationType: text('destination_type'),
  destinationDetails: jsonb('destination_details'),

  // Dates
  arrivalDate: timestamp('arrival_date'),
  paidAt: timestamp('paid_at'),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 7. Customers (NEW - separate entity)

```typescript
export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations (optional)
  userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
  organizationId: text('organization_id').references(() => organization.id, {
    onDelete: 'set null',
  }),

  // Stripe
  stripeCustomerId: text('stripe_customer_id').notNull().unique(),

  // Customer Info
  email: text('email').notNull(),
  name: text('name'),
  phone: text('phone'),

  // Address
  address: jsonb('address').$type<Address>(),

  // Payment Methods
  defaultPaymentMethodId: text('default_payment_method_id'),

  // Metadata
  metadata: jsonb('metadata'),

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 8. Webhook Events (from Laravel `webhook_calls`)

```typescript
export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Stripe Event
  stripeEventId: text('stripe_event_id').notNull().unique(),
  eventType: text('event_type').notNull(),

  // Processing
  processed: boolean('processed').notNull().default(false),
  processedAt: timestamp('processed_at'),

  // Error Handling
  error: text('error'),
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(3),

  // Audit
  payload: jsonb('payload').notNull(),
  headers: jsonb('headers'),
  url: text('url'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1) ✅ COMPLETED

- [x] Create all database schemas ✅ COMPLETED
- [x] Setup Stripe client wrapper ✅ COMPLETED
- [x] Create repositories ✅ COMPLETED
- [x] Basic services structure ✅ COMPLETED
- [x] Webhook endpoint (stores events) ✅ COMPLETED

### Phase 2: Connected Accounts (Week 2) ✅ COMPLETED

- [x] Create account endpoint ✅ COMPLETED
- [x] Account sessions (onboarding, payments view) ✅ COMPLETED
- [x] Get account details ✅ COMPLETED
- [x] Handle customer webhooks ✅ COMPLETED
- [x] Account status helpers ✅ COMPLETED

### Phase 3: Invoices (Week 3) ⏳ PLANNED

- [ ] Create invoice endpoint (like Laravel)
- [ ] Invoice line items
- [ ] Send invoice
- [ ] Handle invoice.paid webhook
- [ ] Calculate & track application fees
- [ ] Generate invoice numbers
- [ ] Transfer to connected account

### Phase 4: Direct Payments (Week 4) ⏳ PLANNED

- [ ] Create payment intent
- [ ] Confirm payment
- [ ] Handle charge.succeeded webhook
- [ ] Calculate fees
- [ ] Send receipts

### Phase 5: Payouts & Reporting (Week 5) ⏳ PLANNED

- [ ] List payouts
- [ ] Handle payout.paid webhook
- [ ] Calculate payout fees
- [ ] Financial reporting
- [ ] Dashboard analytics

---

## Key Improvements Over Laravel

1. **Separation of Concerns** - Each service does ONE thing
2. **Payment Intent Tracking** - Full lifecycle tracking
3. **Customer Entity** - Flexible, not tied to organizations
4. **Type Safety** - Typed JSON fields
5. **Better Error Handling** - Retry logic + webhook event storage
6. **Refund/Dispute Tracking** - Can be added easily
7. **organization_id** - Uses Better Auth organizations
8. **Fee Service** - Centralized fee calculation
9. **Receipt Service** - Dedicated receipt generation
10. **Modular** - Easy to test & extend

---

## Current Status ✅

### Completed Features

1. **Stripe Module** - Complete customer management and webhook handling
2. **Connected Accounts** - Account creation, sessions, and status management
3. **Webhook Processing** - Event verification, storage, and async processing
4. **Database Schemas** - Customers and webhook events with proper typing
5. **API Endpoints** - All customer and connected account endpoints

### Available API Endpoints

```
POST /api/stripe/customers                    # Create customer
GET  /api/stripe/customers/:id                # Get customer
POST /api/stripe/connected-accounts           # Create connected account
GET  /api/stripe/connected-accounts           # Get account details
POST /api/stripe/connected-accounts/onboarding-session  # Onboarding session
POST /api/stripe/connected-accounts/payments-session    # Payments session
POST /api/stripe/webhooks                     # Webhook handler
```

### Next Steps

1. ✅ Phase 1 & 2 Complete - Foundation and Connected Accounts
2. ⏳ Phase 3 - Implement Invoices as separate feature module
3. ⏳ Phase 4 - Direct Payments (payment intents)
4. ⏳ Phase 5 - Payouts & Reporting
5. 🧪 Testing - Deploy & test with Stripe test mode
