# Organization Subscription System - Implementation Plan for Blawby-TS

## 📋 Executive Summary

**Goal**: Implement IOLTA-compliant subscription system that auto-charges organizations for Blawby usage, completely separate from Connect accounts.

**Key Principle**: Two separate Stripe contexts:

1. **Connect Account** (IOLTA) - Client payments, never touched
2. **Platform Customer + Subscription** - Org pays Blawby via business credit card

**Flow**: Connect onboarding → Payment method setup → Auto-subscription creation → Monthly auto-billing

---

## 🏛️ IOLTA Compliance Architecture

### Critical Separation:

| Purpose              | Stripe Entity           | Used For                 | Database                                             |
| -------------------- | ----------------------- | ------------------------ | ---------------------------------------------------- |
| **Client Payments**  | Connect Account         | IOLTA trust account      | `stripe_connected_accounts`                          |
| **Platform Billing** | Customer + Subscription | Blawby subscription fees | `organizations.stripe_customer_id` + `subscriptions` |

**Why?** Cannot deduct fees from client payments (IOLTA violation). Must charge org's business payment method separately.

---

## 📊 Database Schema Changes

### Phase 1: Rename Existing Table

**`customers` → `clients`** (org's external clients who get invoiced)

### Phase 2: Modify Organizations Table

Add fields:

- `stripe_customer_id` (for platform billing)
- `stripe_payment_method_id`
- `billing_email`
- `active_subscription_id`
- `payment_method_setup_at`

### Phase 3: Create New Tables

#### **`subscriptions`** - Main subscription table

**Columns:**

```typescript
id: uuid, primary key
organization_id: text, references organizations.id, cascade delete
stripe_customer_id: text, not null (platform customer, not Connect)
stripe_subscription_id: text, not null, unique
stripe_payment_method_id: text, nullable
plan_id: uuid, references subscription_plans.id
plan_name: text, not null (denormalized for quick access)
billing_cycle: text, not null ('monthly' | 'yearly')
status: text, not null
  // 'incomplete', 'incomplete_expired', 'trialing', 'active',
  // 'past_due', 'canceled', 'unpaid'
current_period_start: timestamp, not null
current_period_end: timestamp, not null
trial_ends_at: timestamp, nullable
canceled_at: timestamp, nullable
cancel_at_period_end: boolean, default false
ends_at: timestamp, nullable
amount: decimal(10,2), not null
currency: text, default 'usd'
features: jsonb (array of feature strings, denormalized from plan)
limits: jsonb (object with limit definitions, denormalized from plan)
metadata: jsonb
created_at: timestamp, default now()
updated_at: timestamp, default now()
```

**Indexes:**

- `(organization_id, status)` - Find org's active subscription
- `stripe_subscription_id` - Webhook lookups
- `current_period_end` - Find expiring subscriptions
- `status` - Query by status

**Relationships:**

- Belongs to: `organizations`
- Belongs to: `subscription_plans`
- Has many: `subscription_line_items`
- Has many: `subscription_events`

---

#### **`subscription_plans`** - Plan definitions

**Columns:**

```typescript
id: uuid, primary key
name: text, not null, unique ('starter', 'professional', 'enterprise')
display_name: text, not null ('Starter Plan', 'Professional Plan')
description: text, nullable
monthly_price: decimal(10,2), not null
yearly_price: decimal(10,2), not null
stripe_monthly_price_id: text, not null (Stripe price ID on platform account)
stripe_yearly_price_id: text, not null (Stripe price ID on platform account)
stripe_product_id: text, not null (Stripe product ID)
features: jsonb, not null (array of feature strings)
  // Example: ['invoicing', 'payments', 'advanced_reporting', 'api_access', 'webhooks']
limits: jsonb, not null (object with limit definitions)
  // Example: { users: 10, invoices_per_month: 100, storage_gb: 50 }
  // -1 = unlimited
metered_items: jsonb, nullable (array of metered price configurations)
  // Example: [
  //   { priceId: 'price_xxx', meterName: 'active_users', type: 'user_count' },
  //   { priceId: 'price_yyy', meterName: 'invoice_fees', type: 'invoice_fee' }
  // ]
is_active: boolean, default true
is_public: boolean, default true (show on pricing page)
sort_order: integer, default 0 (display order)
metadata: jsonb
created_at: timestamp, default now()
updated_at: timestamp, default now()
```

**Indexes:**

- `name` - Lookup by plan name
- `(is_active, sort_order)` - Get active plans in order

**Relationships:**

- Has many: `subscriptions`

---

#### **`subscription_line_items`** - Subscription items

**Columns:**

```typescript
id: uuid, primary key
subscription_id: uuid, references subscriptions.id, cascade delete
stripe_subscription_item_id: text, not null, unique
stripe_price_id: text, not null
item_type: text, not null
  // 'base_fee' | 'metered_users' | 'metered_invoice_fee' |
  // 'metered_payout_fee' | 'metered_custom_payment_fee'
description: text, nullable
quantity: integer, default 1
unit_amount: decimal(10,2), nullable (null for metered items)
metadata: jsonb
created_at: timestamp, default now()
updated_at: timestamp, default now()
```

**Indexes:**

- `subscription_id` - Get all items for subscription
- `stripe_subscription_item_id` - Webhook lookups

**Relationships:**

- Belongs to: `subscriptions`

---

#### **`subscription_events`** - Audit trail

**Columns:**

```typescript
id: uuid, primary key
subscription_id: uuid, references subscriptions.id, cascade delete
event_type: text, not null
  // 'created', 'plan_changed', 'status_changed', 'canceled',
  // 'resumed', 'payment_succeeded', 'payment_failed', 'trial_ending'
from_status: text, nullable
to_status: text, nullable
from_plan_id: uuid, nullable, references subscription_plans.id
to_plan_id: uuid, nullable, references subscription_plans.id
triggered_by: text, nullable, references users.id (who triggered action)
triggered_by_type: text, nullable ('user' | 'system' | 'webhook')
metadata: jsonb (additional event context)
error_message: text, nullable (for failed events)
created_at: timestamp, default now()
```

**Indexes:**

- `subscription_id` - Get event history
- `event_type` - Query by event type
- `created_at` - Time-based queries

**Relationships:**

- Belongs to: `subscriptions`
- Belongs to: `subscription_plans` (from_plan_id)
- Belongs to: `subscription_plans` (to_plan_id)
- Belongs to: `users` (triggered_by)

---

## 🎯 Complete Implementation Flow

### Step 1: Onboarding (Existing + Enhanced)

**Current Flow:**

1. User creates organization
2. Start Stripe Connect onboarding
3. Complete business verification
4. Webhook: `account.updated` → charges_enabled & payouts_enabled = true

**New Addition:** 5. After verification, trigger payment method collection 6. Show "Setup Billing" screen (not dashboard yet)

### Step 2: Payment Method Collection (NEW)

**Frontend:**

- Display plan selection (or default to starter)
- Show Stripe Payment Element for card collection
- "Complete Setup" button

**Backend:**

```
POST /api/subscriptions/setup-payment
- Create Stripe Customer on platform account
- Create SetupIntent for payment method collection
- Return client_secret to frontend
```

**After Payment Method Confirmed:**

```
POST /api/subscriptions/complete-setup
- Attach payment method to customer
- Set as default payment method
- Save to organizations table
- Automatically create subscription
- Redirect to dashboard
```

### Step 3: Auto-Create Subscription

**Triggered by:** Payment method setup completion

**Process:**

1. Verify Connect account active
2. Verify payment method attached
3. Get default plan (starter)
4. Create Stripe subscription with auto-charge enabled
5. Create local subscription record
6. Create subscription line items
7. Record initial usage (1 user)
8. Log creation event
9. Mark onboarding complete

### Step 4: Ongoing Auto-Billing

**Monthly Process:**

- Stripe automatically charges customer
- Webhooks update local status
- Usage meters track metered billing
- Email receipts sent automatically

---

## 🔧 Key Services to Build

### 1. PaymentSetupService

**Methods:**

- `createPlatformCustomer(orgId)` - Create Stripe customer on YOUR account
- `createSetupIntent(customerId)` - Generate payment collection intent
- `attachPaymentMethod(orgId, paymentMethodId)` - Save payment method
- `verifyPaymentMethod(pmId)` - Validate payment method

### 2. SubscriptionService

**Methods:**

- `createSubscriptionForOrganization(orgId, planName, billingCycle)` - Create subscription after payment setup
- `changePlan(subId, newPlan, prorate)` - Upgrade/downgrade
- `cancelSubscription(subId, immediately)` - Cancel (immediate or end of period)
- `resumeSubscription(subId)` - Reactivate
- `syncFromStripe(stripeSubId)` - Sync status from Stripe
- `checkAccess(orgId, feature)` - Feature gate check
- `checkLimit(orgId, limitType)` - Usage limit check

### 3. PlanService

**Methods:**

- `getAllActivePlans()` - Get available plans
- `getPlanByName(name)` - Get specific plan
- `syncPlansFromStripe()` - Sync from Stripe dashboard
- `getRecommendedPlan(orgId)` - Suggest plan based on usage

### 4. UsageService

**Methods:**

- `recordUserAdded(orgId, customerId)` - Log user meter event
- `recordInvoicePaid(orgId, customerId, amount)` - Log invoice fee
- `recordPayoutProcessed(orgId, customerId, amount)` - Log payout fee
- `getCurrentUsage(orgId, meterType)` - Get current period usage

### 5. EventLoggerService

**Methods:**

- `logCreated(subscription)` - Log creation
- `logPlanChanged(sub, fromPlan, toPlan)` - Log plan change
- `logStatusChanged(sub, fromStatus, toStatus)` - Log status change
- `logPaymentFailed(sub, reason)` - Log payment failure

---

## 🌐 API Routes

### Subscription Management

- `POST /api/subscriptions/setup-payment` - Initiate payment setup
- `POST /api/subscriptions/complete-setup` - Complete setup & create subscription
- `POST /api/subscriptions` - Create subscription (manual)
- `GET /api/subscriptions/:id` - Get subscription details
- `GET /api/organizations/:orgId/subscription` - Get active subscription
- `PATCH /api/subscriptions/:id/plan` - Change plan
- `DELETE /api/subscriptions/:id` - Cancel subscription
- `POST /api/subscriptions/:id/resume` - Resume subscription
- `GET /api/subscription-plans` - List available plans
- `GET /api/organizations/:orgId/usage` - Get current usage

### Admin Routes

- `POST /admin/subscriptions/:id/sync` - Force sync from Stripe
- `POST /admin/subscription-plans/sync` - Sync all plans from Stripe

---

## 🔄 Webhook Handlers

### Update Existing Handler

**`account.updated` (in onboarding module)**

After verifying Connect account is fully active:

```typescript
if (charges_enabled && payouts_enabled && no_requirements_due) {
  // Mark Connect as active
  await updateConnectAccountStatus(accountId, 'active');

  // Trigger payment method collection
  // (Frontend will redirect user to billing setup)
  await markReadyForBillingSetup(organizationId);
}
```

### New Subscription Webhook Handlers

**`customer.subscription.created`**

- Create/update local subscription record
- Log creation event

**`customer.subscription.updated`**

- Sync subscription status and dates
- If status changed, log event
- Handle specific transitions (trial ending, etc.)

**`customer.subscription.deleted`**

- Update status to canceled
- Set ends_at timestamp
- Log deletion event

**`invoice.payment_succeeded`**

- Update subscription to active
- Extend current period
- Send receipt email
- Log payment success

**`invoice.payment_failed`**

- Update status to past_due
- Log failure with reason
- Send "update payment method" email
- Trigger retry logic

**`setup_intent.succeeded`**

- Confirm payment method attached
- Can proceed with subscription creation

---

## 🧩 Integration Points

### 1. Onboarding Module Updates

**File**: `src/modules/onboarding/services/onboarding.service.ts`

Add method: `completeOnboardingWithSubscription(orgId)`

- Validates Connect account active
- Creates platform customer
- Triggers payment setup flow
- Creates subscription after payment
- Marks onboarding complete

### 2. Customer Service (Keep Existing)

Already exists at `src/modules/customers/` - just rename to clients

### 3. Feature Gate Middleware

**File**: `src/shared/middleware/subscription.middleware.ts`

**Middleware functions:**

- `requireFeature(featureName)` - Block if feature not in plan
- `checkLimit(limitType)` - Block if limit exceeded
- `requireActiveSubscription()` - Block if no active subscription

**Usage:**

```typescript
router.post('/api/invoices', checkLimit('invoices_per_month'), createInvoice);
router.get(
  '/api/analytics',
  requireFeature('advanced_reporting'),
  getAnalytics,
);
```

---

## 📱 Frontend Integration

### Updated Onboarding Flow

**Steps:**

1. Create organization
2. Start Stripe Connect onboarding
3. Complete business verification → webhook marks ready
4. **NEW: Billing Setup Screen**
   - Show plan options
   - Stripe Payment Element
   - Collect card details
   - Submit → create subscription
5. Redirect to dashboard

### Billing Setup Component

**What to build:**

- Plan selection cards (or default to starter)
- Stripe Payment Element integration
- Loading states during setup
- Error handling for declined cards
- Success confirmation

### Subscription Context/State

**Provide to frontend:**

```typescript
{
  subscription: Subscription | null,
  plan: Plan | null,
  status: 'active' | 'trialing' | 'past_due' | 'none',
  features: string[],
  limits: Record<string, { limit, used, remaining }>,
  isLoading: boolean,
  canAccessFeature: (feature: string) => boolean,
  isWithinLimit: (limitType: string) => boolean,
}
```

---

## ⏰ Background Jobs

### 1. Sync Subscriptions Job

**Schedule**: Every 6 hours
**Purpose**: Sync all active subscriptions from Stripe
**Action**: Update statuses, periods, detect discrepancies

### 2. Trial Ending Notifications

**Schedule**: Daily at 9am
**Purpose**: Notify orgs with trials ending in 3 days
**Action**: Send reminder emails

### 3. Past Due Handler

**Schedule**: Daily at 10am
**Purpose**: Handle past_due subscriptions
**Action**: Send escalating reminders, cancel after 30 days

### 4. Cleanup Canceled Subscriptions

**Schedule**: Weekly
**Purpose**: Archive old canceled subscriptions (>90 days)
**Action**: Move to cold storage or mark archived

---

## 🌱 Seed Data

### Default Subscription Plans

**Starter Plan** (Free tier)

- Price: $0/month
- Features: ['invoicing', 'payments', 'basic_reporting']
- Limits: { users: 3, invoices_per_month: 50 }
- Metered fees: 2% invoice fee, 2% payout fee

**Professional Plan**

- Price: $99/month or $990/year
- Features: ['invoicing', 'payments', 'advanced_reporting', 'api_access', 'webhooks']
- Limits: { users: 10, invoices_per_month: 200 }
- Metered fees: 1% invoice fee, 1% payout fee

**Enterprise Plan**

- Price: $299/month or $2990/year
- Features: ['all']
- Limits: { users: -1, invoices_per_month: -1 } // unlimited
- Metered fees: 0.5% invoice fee, 0.5% payout fee

**Create in Stripe first**, then sync to database

---

## 🔒 Security & Validation

### Always Validate:

- User is member of organization before viewing/modifying subscription
- Organization owns the subscription being accessed
- Stripe webhook signatures
- Payment methods are valid before charging
- Organizations have active Connect account before billing

### Idempotency:

- All webhook handlers must handle duplicate events
- Use Stripe event IDs to prevent double-processing
- Database constraints prevent duplicate subscriptions

### Rate Limiting:

- Subscription endpoints: 20 requests/minute per org
- Payment setup: 5 attempts/hour per org
- Plan changes: 10 per day per org

---

## 🧪 Testing Strategy

### Unit Tests

- Repository CRUD operations
- Service business logic
- Validation schemas
- Feature gate logic
- Limit checking logic

### Integration Tests

- Complete subscription creation flow
- Payment method setup flow
- Plan upgrade/downgrade
- Webhook event processing
- Usage tracking

### E2E Tests

- Full onboarding → subscription → billing cycle
- Payment failure recovery
- Trial expiration handling
- Cancellation and resume flows

---

## 📊 Key Metrics to Track

**Subscription Health:**

- Active subscriptions by plan
- Monthly Recurring Revenue (MRR)
- Trial conversion rate
- Churn rate
- Payment failure rate

**Usage Metrics:**

- Average users per organization
- Average invoices per month
- Feature adoption rates
- Limit violation frequency

**Business Metrics:**

- Revenue by plan
- Customer Lifetime Value (LTV)
- Upgrade/downgrade rates

---

## ✅ Implementation Checklist

### Week 1: Foundation

- [ ] Rename `customers` to `clients`
- [ ] Add billing fields to `organizations`
- [ ] Create subscription tables (subscriptions, plans, items, events)
- [ ] Run migrations
- [ ] Create Drizzle schemas and Zod validators

### Week 2: Core Services

- [ ] Build PaymentSetupService
- [ ] Build SubscriptionService
- [ ] Build PlanService
- [ ] Build UsageService
- [ ] Build EventLoggerService
- [ ] Create repositories

### Week 3: Integration

- [ ] Create subscription API routes
- [ ] Update onboarding webhook handler
- [ ] Create subscription webhook handlers
- [ ] Build feature gate middleware
- [ ] Apply middleware to protected routes

### Week 4: Polish & Deploy

- [ ] Create seed data (plans)
- [ ] Build frontend billing setup component
- [ ] Create background jobs
- [ ] Write tests
- [ ] Documentation
- [ ] Deploy to staging
- [ ] Test end-to-end
- [ ] Production deployment

---

## 🚀 Migration Strategy for Existing Orgs

### Backfill Script

For organizations that completed onboarding before subscription system:

1. Get all orgs with active Connect accounts
2. For each org:
   - Create platform Stripe customer
   - Prompt for payment method (email link)
   - Create starter subscription once payment added
   - Backfill usage events
3. Grace period: 30 days to add payment method

---

## 💡 Key Design Decisions

**Why separate customer for billing?**

- IOLTA compliance requires complete separation
- Platform billing != client payment processing
- Different Stripe accounts (platform vs Connect)

**Why auto-charge vs invoicing?**

- Prevents non-payment issues
- Predictable revenue
- Standard SaaS practice
- Required payment method ensures collectability

**Why denormalize features/limits in subscription?**

- Fast access checks without joins
- Historical record if plans change
- Simpler queries for middleware

**Why metered + base pricing?**

- Aligns cost with value
- Fairer for different org sizes
- Predictable base + usage-based
- Common in legal tech

---

## 🎯 Success Criteria

**Technical:**

- 99.9% webhook processing success
- <100ms subscription status checks
- Zero data drift between Stripe and database
- Complete audit trail

**Business:**

- > 60% trial conversion rate
- <5% monthly churn
- > 70% on paid plans within 90 days
- Payment failure rate <3%

**User Experience:**

- Seamless onboarding flow
- Clear plan limits and usage visibility
- Easy upgrade/downgrade
- Helpful payment failure messaging

---

## 📚 Documentation Needed

1. **API Documentation** - OpenAPI spec with all endpoints
2. **Internal Architecture** - How subscription system works
3. **Runbook** - Troubleshooting common issues
4. **Admin Guide** - How to manage plans, handle edge cases
5. **Frontend Integration Guide** - How to use subscription context

---

## 🔮 Future Enhancements

**Phase 2 (Post-MVP):**

- Custom enterprise pricing
- Discount codes/promotions
- Annual prepay discounts
- Multiple payment methods
- Usage forecasting
- Budget alerts
- Detailed analytics dashboard
- Self-service plan management
- Payment method update flow
- Pause/resume subscriptions

---

## 📞 Summary

This plan implements a complete, IOLTA-compliant subscription system that:

✅ Separates platform billing from client payments (IOLTA requirement)
✅ Auto-charges organizations monthly (no payment avoidance)
✅ Collects payment method during onboarding (seamless flow)
✅ Scales with usage-based metering (fair pricing)
✅ Enforces plan limits and features (access control)
✅ Provides complete audit trail (compliance)
✅ Integrates cleanly with existing architecture (minimal disruption)

**Next Step:** Start with Week 1 foundation work (database migrations and schemas)
