# Phase 4: Payouts & Balance Management

## Goal
Track account balances, manage payouts to connected accounts, and provide financial reporting.

---

## Database Tables

### payouts
```sql
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  connected_account_id UUID NOT NULL REFERENCES connected_accounts(id),
  stripe_payout_id TEXT UNIQUE NOT NULL,
  amount BIGINT NOT NULL, -- cents
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL, -- 'pending', 'paid', 'failed', 'canceled', 'in_transit'
  arrival_date TIMESTAMPTZ NOT NULL,
  method TEXT, -- 'standard', 'instant'
  type TEXT, -- 'bank_account', 'card'
  destination JSONB, -- bank account or debit card details
  description TEXT,
  failure_code TEXT,
  failure_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payouts_org ON payouts(organization_id);
CREATE INDEX idx_payouts_stripe_id ON payouts(stripe_payout_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_payouts_arrival ON payouts(arrival_date);
```

### balance_transactions
```sql
CREATE TABLE balance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  connected_account_id UUID NOT NULL REFERENCES connected_accounts(id),
  stripe_balance_txn_id TEXT UNIQUE NOT NULL,
  amount BIGINT NOT NULL,
  currency TEXT DEFAULT 'usd',
  net_amount BIGINT NOT NULL, -- amount after fees
  fee BIGINT DEFAULT 0,
  type TEXT NOT NULL, -- 'charge', 'refund', 'adjustment', 'application_fee', 'payout', etc.
  source_id TEXT, -- related payment_id, refund_id, etc.
  description TEXT,
  available_on TIMESTAMPTZ NOT NULL, -- when funds become available
  created TIMESTAMPTZ NOT NULL,
  metadata JSONB
);

CREATE INDEX idx_balance_txns_org ON balance_transactions(organization_id);
CREATE INDEX idx_balance_txns_stripe_id ON balance_transactions(stripe_balance_txn_id);
CREATE INDEX idx_balance_txns_type ON balance_transactions(type);
CREATE INDEX idx_balance_txns_available ON balance_transactions(available_on);
```

---

## API Routes

### GET /api/balance
**Get current account balance**

Logic:
1. Get organizationId, find connected_account
2. Retrieve balance from Stripe:
```typescript
const balance = await stripe.balance.retrieve({
  stripeAccount: connectedAccount.stripe_account_id
});
```
3. Return:
```typescript
{
  available: balance.available.map(b => ({ amount: b.amount, currency: b.currency })),
  pending: balance.pending.map(b => ({ amount: b.amount, currency: b.currency })),
  connectReserved: balance.connect_reserved?.map(b => ({ amount: b.amount, currency: b.currency }))
}
```

### GET /api/balance/transactions
**List balance transactions**

Query: `limit`, `offset`, `type`, `startDate`, `endDate`

Logic:
1. Get organizationId, find connected_account
2. Query balance_transactions table with filters
3. Return paginated list

### POST /api/balance/transactions/sync
**Sync balance transactions from Stripe**

Logic:
1. Get organizationId, find connected_account
2. List balance transactions from Stripe:
```typescript
const transactions = await stripe.balanceTransactions.list({
  limit: 100
}, {
  stripeAccount: connectedAccount.stripe_account_id
});
```
3. For each transaction, upsert into balance_transactions table
4. Return count of synced transactions

---

### GET /api/payouts
**List payouts**

Query: `status`, `limit`, `offset`, `startDate`, `endDate`

Logic:
1. Get organizationId
2. Query payouts table with filters
3. Return paginated list

### GET /api/payouts/:id
**Get payout details**

Logic:
1. Find payout, verify ownership
2. Get related balance transactions
3. Return payout with transactions

### POST /api/payouts
**Create manual payout**

Request:
```typescript
{
  amount: number, // cents
  currency?: string,
  method?: 'standard' | 'instant',
  description?: string
}
```

Logic:
1. Get organizationId, find connected_account
2. Get balance, verify sufficient funds
3. Create payout in Stripe:
```typescript
const payout = await stripe.payouts.create({
  amount,
  currency: currency || 'usd',
  method: method || 'standard',
  description
}, {
  stripeAccount: connectedAccount.stripe_account_id
});
```
4. Insert into payouts table
5. Return payout

### POST /api/payouts/:id/cancel
**Cancel pending payout**

Logic:
1. Find payout, verify ownership
2. Verify status === 'pending'
3. Cancel in Stripe:
```typescript
await stripe.payouts.cancel(stripe_payout_id, {
  stripeAccount: connectedAccount.stripe_account_id
});
```
4. Update status = 'canceled'
5. Return payout

---

## Webhooks to Add

### payout.created
```typescript
const payout = event.data.object;
await payoutsRepo.create({
  stripe_payout_id: payout.id,
  amount: payout.amount,
  currency: payout.currency,
  status: payout.status,
  arrival_date: new Date(payout.arrival_date * 1000),
  method: payout.method,
  type: payout.type,
  destination: payout.destination,
  description: payout.description
});
```

### payout.updated
```typescript
const payout = event.data.object;
await payoutsRepo.updateByStripeId(payout.id, {
  status: payout.status
});
```

### payout.paid
```typescript
const payout = event.data.object;
await payoutsRepo.updateByStripeId(payout.id, {
  status: 'paid'
});
```

### payout.failed
```typescript
const payout = event.data.object;
await payoutsRepo.updateByStripeId(payout.id, {
  status: 'failed',
  failure_code: payout.failure_code,
  failure_message: payout.failure_message
});
```

---

## Financial Reports

### GET /api/reports/revenue
**Revenue report**

Query: `startDate`, `endDate`, `groupBy` ('day', 'week', 'month')

Logic:
1. Get organizationId
2. Query payments where status = 'succeeded' in date range
3. Group by period and sum amounts
4. Return:
```typescript
{
  periods: [
    { date: '2025-01-01', revenue: 150000, count: 45 },
    { date: '2025-02-01', revenue: 175000, count: 52 }
  ],
  total: 325000,
  average: 162500
}
```

### GET /api/reports/fees
**Fee breakdown report**

Query: `startDate`, `endDate`

Logic:
1. Get organizationId
2. Query balance_transactions where type includes fees
3. Calculate:
   - Stripe processing fees
   - Application fees (platform commission)
   - Refund fees
4. Return breakdown

### GET /api/reports/customers
**Customer analytics**

Logic:
1. Get organizationId
2. Aggregate data:
   - Total unique customers (from payments and subscriptions)
   - New customers this period
   - Top customers by revenue
   - Churn rate (for subscriptions)
3. Return summary

---

## Module Structure

```
modules/balance/
├── routes/
│   ├── index.get.ts (get balance)
│   └── transactions/
│       ├── index.get.ts (list)
│       └── sync.post.ts
├── services/
│   └── balance.service.ts
└── repositories/
    └── balance-transactions.repository.ts

modules/payouts/
├── routes/
│   ├── index.get.ts (list)
│   ├── index.post.ts (create)
│   └── [id]/
│       ├── index.get.ts
│       └── cancel.post.ts
├── services/
│   └── payouts.service.ts
└── repositories/
    └── payouts.repository.ts

modules/reports/
└── routes/
    ├── revenue.get.ts
    ├── fees.get.ts
    └── customers.get.ts
```

---

## Key Implementation Notes

1. **Balance types** - Stripe has available, pending, and reserved balances
2. **Payout schedule** - Stripe defaults to automatic daily payouts
3. **Instant payouts** - Cost 1.5% extra, arrive within 30 minutes
4. **Balance transactions** - Created for every payment, refund, fee, etc.
5. **Net vs Gross** - net_amount = amount - fee
6. **Available on date** - Funds held for 2-7 days depending on risk
7. **Sync regularly** - Run sync job daily to keep balance_transactions current

---

## Success Criteria

- [ ] Can view real-time balance
- [ ] Balance transactions synced from Stripe
- [ ] Can list and view payouts
- [ ] Can create manual payouts
- [ ] Webhooks update payout status
- [ ] Revenue reports show accurate data
- [ ] Fee breakdowns calculated correctly
