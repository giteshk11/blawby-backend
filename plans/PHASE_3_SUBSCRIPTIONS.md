# Phase 3: Subscriptions & Recurring Billing

## Goal
Create subscription plans and manage recurring customer billing.

---

## Database Tables

### subscription_plans
```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connected_account_id UUID NOT NULL REFERENCES connected_accounts(id),
  stripe_product_id TEXT UNIQUE NOT NULL,
  stripe_price_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  amount BIGINT NOT NULL, -- cents
  currency TEXT DEFAULT 'usd',
  billing_period TEXT NOT NULL, -- 'day', 'week', 'month', 'year'
  interval_count INTEGER DEFAULT 1, -- bill every N periods
  trial_period_days INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plans_org ON subscription_plans(organization_id);
CREATE INDEX idx_plans_stripe_ids ON subscription_plans(stripe_product_id, stripe_price_id);
CREATE INDEX idx_plans_active ON subscription_plans(organization_id, is_active);
```

### subscriptions
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  connected_account_id UUID NOT NULL REFERENCES connected_accounts(id),
  subscription_plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  status TEXT NOT NULL, -- 'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_plan ON subscriptions(subscription_plan_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(organization_id, status);
```

---

## API Routes

### POST /api/subscription-plans
**Create subscription plan**

Request:
```typescript
{
  name: string,
  description?: string,
  amount: number, // cents
  currency?: string,
  billing_period: 'day' | 'week' | 'month' | 'year',
  interval_count?: number, // default 1
  trial_period_days?: number, // default 0
  metadata?: object
}
```

Logic:
1. Get organizationId, find connected_account
2. Validate account is active
3. Create Stripe Product:
```typescript
const product = await stripe.products.create({
  name,
  description,
  metadata
}, {
  stripeAccount: connectedAccount.stripe_account_id
});
```
4. Create Stripe Price:
```typescript
const price = await stripe.prices.create({
  product: product.id,
  unit_amount: amount,
  currency: currency || 'usd',
  recurring: {
    interval: billing_period,
    interval_count: interval_count || 1
  }
}, {
  stripeAccount: connectedAccount.stripe_account_id
});
```
5. Insert into subscription_plans table
6. Return plan

### GET /api/subscription-plans
**List plans**

Query: `includeInactive` (boolean)

Logic:
1. Get organizationId
2. Query plans, filter by is_active if not includeInactive
3. For each plan, count active subscriptions
4. Return list

### GET /api/subscription-plans/:id
**Get plan details**

Logic:
1. Find plan, verify ownership
2. Count active subscriptions
3. Return plan with subscriber count

### PATCH /api/subscription-plans/:id
**Update plan metadata only**

Request:
```typescript
{
  name?: string,
  description?: string,
  metadata?: object
}
```

Logic:
1. Find plan, verify ownership
2. Update name, description, metadata only (NOT amount or billing_period)
3. Sync to Stripe Product
4. Return updated plan

### DELETE /api/subscription-plans/:id
**Deactivate plan**

Logic:
1. Find plan, verify ownership
2. Set is_active = false (soft delete)
3. Existing subscriptions continue
4. Return plan

---

### POST /api/subscriptions
**Create subscription**

Request:
```typescript
{
  planId: string,
  customerEmail: string,
  customerName?: string,
  paymentMethodId?: string, // if collecting upfront
  metadata?: object
}
```

Logic:
1. Get organizationId, find plan
2. Verify plan.is_active === true
3. Create or retrieve Stripe Customer:
```typescript
const customers = await stripe.customers.list({
  email: customerEmail,
  limit: 1
}, {
  stripeAccount: connectedAccount.stripe_account_id
});

const customer = customers.data[0] || await stripe.customers.create({
  email: customerEmail,
  name: customerName,
  metadata
}, {
  stripeAccount: connectedAccount.stripe_account_id
});
```
4. Attach payment method if provided:
```typescript
if (paymentMethodId) {
  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customer.id
  }, {
    stripeAccount: connectedAccount.stripe_account_id
  });
  
  await stripe.customers.update(customer.id, {
    invoice_settings: {
      default_payment_method: paymentMethodId
    }
  }, {
    stripeAccount: connectedAccount.stripe_account_id
  });
}
```
5. Create Stripe Subscription:
```typescript
const subscription = await stripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: plan.stripe_price_id }],
  trial_period_days: plan.trial_period_days || undefined,
  payment_behavior: 'default_incomplete',
  payment_settings: {
    payment_method_types: ['card'],
    save_default_payment_method: 'on_subscription'
  },
  expand: ['latest_invoice.payment_intent'],
  metadata
}, {
  stripeAccount: connectedAccount.stripe_account_id
});
```
6. Insert into subscriptions table
7. Return:
```typescript
{
  subscriptionId: subscription.id,
  status: subscription.status,
  clientSecret: subscription.latest_invoice.payment_intent.client_secret, // for initial payment
  currentPeriodEnd: subscription.current_period_end
}
```

### GET /api/subscriptions
**List subscriptions**

Query: `status`, `planId`, `customer`, `limit`, `offset`

Logic:
1. Get organizationId
2. Query subscriptions with filters
3. Include plan details
4. Return paginated list

### GET /api/subscriptions/:id
**Get subscription**

Logic:
1. Find subscription, verify ownership
2. Include plan details
3. Return subscription

### POST /api/subscriptions/:id/cancel
**Cancel subscription**

Request:
```typescript
{
  immediately?: boolean // default false (cancel at period end)
}
```

Logic:
1. Find subscription, verify ownership
2. If immediately:
```typescript
await stripe.subscriptions.cancel(stripe_subscription_id, {
  stripeAccount: connectedAccount.stripe_account_id
});
// Update: status = 'canceled', ended_at = now
```
3. Else:
```typescript
await stripe.subscriptions.update(stripe_subscription_id, {
  cancel_at_period_end: true
}, {
  stripeAccount: connectedAccount.stripe_account_id
});
// Update: cancel_at_period_end = true
```
4. Return updated subscription

### POST /api/subscriptions/:id/reactivate
**Reactivate canceled subscription**

Logic:
1. Find subscription, verify ownership
2. Verify cancel_at_period_end === true and ended_at === null
3. Update in Stripe:
```typescript
await stripe.subscriptions.update(stripe_subscription_id, {
  cancel_at_period_end: false
}, {
  stripeAccount: connectedAccount.stripe_account_id
});
```
4. Update DB: cancel_at_period_end = false, canceled_at = null
5. Return subscription

### POST /api/subscriptions/:id/payment-method
**Update payment method**

Request:
```typescript
{
  paymentMethodId: string
}
```

Logic:
1. Find subscription, verify ownership
2. Attach payment method to customer
3. Set as default payment method
4. Return subscription

---

## Webhooks to Add

### customer.subscription.created
```typescript
const sub = event.data.object;
await subscriptionsRepo.create({
  stripe_subscription_id: sub.id,
  stripe_customer_id: sub.customer,
  status: sub.status,
  current_period_start: new Date(sub.current_period_start * 1000),
  current_period_end: new Date(sub.current_period_end * 1000),
  trial_start: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
  trial_end: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
  // ... other fields
});
```

### customer.subscription.updated
```typescript
const sub = event.data.object;
await subscriptionsRepo.updateByStripeId(sub.id, {
  status: sub.status,
  current_period_start: new Date(sub.current_period_start * 1000),
  current_period_end: new Date(sub.current_period_end * 1000),
  cancel_at_period_end: sub.cancel_at_period_end,
  canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null
});
```

### customer.subscription.deleted
```typescript
const sub = event.data.object;
await subscriptionsRepo.updateByStripeId(sub.id, {
  status: 'canceled',
  ended_at: new Date()
});
```

### invoice.paid
```typescript
const invoice = event.data.object;
// Stripe automatically handles subscription invoice payments
// Just log or trigger notifications
```

### invoice.payment_failed
```typescript
const invoice = event.data.object;
// Subscription may move to 'past_due' status
// Send notification to customer
```

---

## Revenue Metrics API

### GET /api/analytics/revenue
**Calculate MRR/ARR**

Logic:
1. Get all active subscriptions for organization
2. Calculate MRR:
```typescript
const activeSubscriptions = await subscriptionsRepo.findByOrganization(orgId, { status: 'active' });

let mrr = 0;
for (const sub of activeSubscriptions) {
  const plan = await plansRepo.findById(sub.subscription_plan_id);
  
  // Normalize to monthly
  let monthlyAmount = plan.amount;
  if (plan.billing_period === 'year') {
    monthlyAmount = plan.amount / 12;
  } else if (plan.billing_period === 'week') {
    monthlyAmount = plan.amount * 4.33;
  } else if (plan.billing_period === 'day') {
    monthlyAmount = plan.amount * 30;
  }
  
  mrr += monthlyAmount / plan.interval_count;
}

const arr = mrr * 12;
```
3. Return:
```typescript
{
  mrr: Math.round(mrr), // in cents
  arr: Math.round(arr),
  activeSubscribers: activeSubscriptions.length,
  currency: 'usd'
}
```

---

## Module Structure

```
modules/subscription-plans/
├── routes/
│   ├── index.get.ts
│   ├── index.post.ts
│   └── [id]/
│       ├── index.get.ts
│       ├── index.patch.ts
│       └── index.delete.ts
├── services/
│   └── subscription-plans.service.ts
└── repositories/
    └── subscription-plans.repository.ts

modules/subscriptions/
├── routes/
│   ├── index.get.ts
│   ├── index.post.ts
│   └── [id]/
│       ├── index.get.ts
│       ├── cancel.post.ts
│       ├── reactivate.post.ts
│       └── payment-method.post.ts
├── services/
│   └── subscriptions.service.ts
└── repositories/
    └── subscriptions.repository.ts

modules/analytics/
└── routes/
    └── revenue.get.ts
```

---

## Key Implementation Notes

1. **Products vs Prices** - Stripe Product = plan template, Price = pricing model
2. **Cannot change price** - To change amount, create new plan and migrate subscribers
3. **Trials** - Set `trial_period_days` on plan, auto-applies to new subscriptions
4. **Payment collection** - Use `payment_behavior: 'default_incomplete'` for initial setup
5. **Customer deduplication** - Always search by email first to avoid duplicate customers
6. **Cancellation timing** - cancel_at_period_end = true lets them use until period ends
7. **Proration** - Stripe handles automatically when changing plans
8. **MRR calculation** - Normalize all periods to monthly equivalent

---

## Success Criteria

- [ ] Create subscription plans in Stripe
- [ ] Customers can subscribe with payment method
- [ ] Automatic billing works (via Stripe)
- [ ] Webhooks update subscription status
- [ ] Can cancel/reactivate subscriptions
- [ ] Can update payment methods
- [ ] MRR/ARR calculated correctly
- [ ] Trial periods work
