# Phase 2: Payment Processing & Invoicing

## Goal
Accept payments and create invoices for connected accounts.

---

## Database Tables

### payments
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connected_account_id UUID NOT NULL REFERENCES connected_accounts(id),
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  amount BIGINT NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL, -- 'requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'succeeded', 'canceled'
  client_secret TEXT,
  customer_email TEXT,
  customer_name TEXT,
  description TEXT,
  metadata JSONB,
  invoice_id UUID REFERENCES invoices(id),
  application_fee_amount BIGINT,
  last_payment_error JSONB,
  succeeded_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_org ON payments(organization_id);
CREATE INDEX idx_payments_stripe_id ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_org_status ON payments(organization_id, status);
```

### invoices
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connected_account_id UUID NOT NULL REFERENCES connected_accounts(id),
  invoice_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL, -- 'draft', 'sent', 'paid', 'overdue', 'canceled'
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_address JSONB,
  line_items JSONB NOT NULL, -- [{ description, quantity, unit_price, amount }]
  subtotal BIGINT NOT NULL,
  tax_amount BIGINT DEFAULT 0,
  discount_amount BIGINT DEFAULT 0,
  total_amount BIGINT NOT NULL,
  currency TEXT DEFAULT 'usd',
  notes TEXT,
  terms TEXT,
  due_date TIMESTAMPTZ,
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_org ON invoices(organization_id);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_customer ON invoices(customer_email);
```

### refunds
```sql
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  stripe_refund_id TEXT UNIQUE NOT NULL,
  amount BIGINT NOT NULL,
  reason TEXT, -- 'duplicate', 'fraudulent', 'requested_by_customer'
  status TEXT NOT NULL, -- 'pending', 'succeeded', 'failed', 'canceled'
  metadata JSONB,
  failure_reason TEXT,
  succeeded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_refunds_stripe_id ON refunds(stripe_refund_id);
```

---

## API Routes

### POST /api/payments/intents
**Create payment intent**

Request:
```typescript
{
  amount: number, // cents
  currency?: string,
  description?: string,
  customerEmail?: string,
  customerName?: string,
  invoiceId?: string,
  metadata?: object
}
```

Logic:
1. Get organizationId from session
2. Find connected_account by organization_id
3. Validate account is active (charges_enabled && payouts_enabled)
4. Calculate application_fee_amount = Math.round(amount * 0.029) + 30
5. Create Stripe PaymentIntent:
```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount,
  currency: currency || 'usd',
  application_fee_amount: applicationFee,
  description,
  metadata: { ...metadata, invoice_id: invoiceId }
}, {
  stripeAccount: connectedAccount.stripe_account_id
});
```
6. Insert into payments table
7. Return { paymentId, clientSecret, amount, currency, status }

### GET /api/payments
**List payments**

Query params: `status`, `limit`, `offset`, `startDate`, `endDate`

Logic:
1. Get organizationId from session
2. Query payments with filters
3. Return paginated list

### GET /api/payments/:id
**Get payment details**

Logic:
1. Find payment by id
2. Verify payment.organization_id === session.organizationId
3. Return payment

### POST /api/payments/:id/cancel
**Cancel payment intent**

Logic:
1. Find payment, verify ownership
2. Verify status allows cancellation (not 'succeeded' or 'canceled')
3. Cancel in Stripe: `await stripe.paymentIntents.cancel(stripe_payment_intent_id, {}, { stripeAccount })`
4. Update payment: status = 'canceled', canceled_at = now
5. Return updated payment

---

### POST /api/invoices
**Create invoice**

Request:
```typescript
{
  customerEmail: string,
  customerName: string,
  customerAddress?: { line1, line2?, city, state, postal_code, country },
  lineItems: [{ description: string, quantity: number, unit_price: number }],
  taxAmount?: number,
  discountAmount?: number,
  notes?: string,
  terms?: string,
  dueDate?: string,
  metadata?: object
}
```

Logic:
1. Get organizationId, find connected_account
2. Generate invoice_number: `INV-${year}-${padded_sequence}`
3. Calculate totals:
   - subtotal = sum of (quantity * unit_price)
   - total_amount = subtotal + taxAmount - discountAmount
4. Insert invoice with status 'draft'
5. Return invoice

### GET /api/invoices
**List invoices**

Query params: `status`, `customer`, `limit`, `offset`

Logic:
1. Get organizationId
2. Query invoices with filters
3. Return paginated list

### GET /api/invoices/:id
**Get invoice**

Logic:
1. Find invoice, verify ownership
2. Include linked payment if exists
3. Return invoice with payment status

### PATCH /api/invoices/:id
**Update invoice (draft only)**

Logic:
1. Find invoice, verify ownership
2. Verify status === 'draft'
3. Update allowed fields (lineItems, notes, terms, etc.)
4. Recalculate totals if lineItems changed
5. Return updated invoice

### POST /api/invoices/:id/send
**Send invoice**

Logic:
1. Find invoice, verify ownership
2. Update: status = 'sent', issued_at = now
3. Generate PDF if not exists (see PDF generation below)
4. Create payment link via POST /api/invoices/:id/payment-link
5. Return { invoice, paymentLink, pdfUrl }

### POST /api/invoices/:id/payment-link
**Generate payment link**

Logic:
1. Find invoice, verify ownership
2. Create payment intent for invoice.total_amount
3. Link: invoice_id in payment record
4. Return { clientSecret, paymentId }

---

### POST /api/refunds
**Create refund**

Request:
```typescript
{
  paymentId: string,
  amount?: number, // if not provided, full refund
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
}
```

Logic:
1. Find payment, verify ownership
2. Verify payment.status === 'succeeded'
3. Validate amount <= payment.amount
4. Create Stripe refund:
```typescript
const refund = await stripe.refunds.create({
  payment_intent: payment.stripe_payment_intent_id,
  amount: amount || payment.amount,
  reason
}, {
  stripeAccount: connectedAccount.stripe_account_id
});
```
5. Insert into refunds table
6. Return refund

### GET /api/refunds
**List refunds**

Logic:
1. Query refunds for organization
2. Include payment details
3. Return list

---

## Webhooks to Add

In `/api/onboarding/webhooks/stripe`, add these event handlers:

### payment_intent.succeeded
```typescript
const payment = await paymentsRepo.findByStripeId(event.data.object.id);
await paymentsRepo.update(payment.id, {
  status: 'succeeded',
  succeeded_at: new Date()
});

// If linked to invoice, mark invoice as paid
if (payment.invoice_id) {
  await invoicesRepo.update(payment.invoice_id, {
    status: 'paid',
    paid_at: new Date()
  });
}
```

### payment_intent.payment_failed
```typescript
const payment = await paymentsRepo.findByStripeId(event.data.object.id);
await paymentsRepo.update(payment.id, {
  last_payment_error: event.data.object.last_payment_error
});
```

### payment_intent.canceled
```typescript
const payment = await paymentsRepo.findByStripeId(event.data.object.id);
await paymentsRepo.update(payment.id, {
  status: 'canceled',
  canceled_at: new Date()
});
```

### charge.refunded
```typescript
const refund = await refundsRepo.findByStripeId(event.data.object.refunds.data[0].id);
await refundsRepo.update(refund.id, {
  status: 'succeeded',
  succeeded_at: new Date()
});
```

---

## Services Structure

### PaymentsService
- `createPaymentIntent(orgId, data)` - Validates account, creates Stripe PI, saves to DB
- `getPayment(orgId, paymentId)` - Finds and returns payment
- `listPayments(orgId, filters)` - Lists with pagination
- `cancelPayment(orgId, paymentId)` - Cancels PI in Stripe and DB

### InvoicesService
- `createInvoice(orgId, data)` - Generates number, calculates totals, saves
- `getInvoice(orgId, invoiceId)` - Returns invoice with payment info
- `listInvoices(orgId, filters)` - Lists with pagination
- `updateInvoice(orgId, invoiceId, data)` - Updates draft invoices
- `sendInvoice(orgId, invoiceId)` - Marks sent, generates PDF
- `generateInvoiceNumber()` - Returns next sequential number
- `generatePaymentLink(invoiceId)` - Creates payment intent for invoice

### RefundsService
- `createRefund(orgId, paymentId, amount, reason)` - Creates refund in Stripe and DB
- `getRefund(orgId, refundId)` - Returns refund details
- `listRefunds(orgId, filters)` - Lists refunds

---

## PDF Generation (Optional)

Use PDFKit or Puppeteer to generate invoice PDFs.

Simple approach with PDFKit:
```typescript
import PDFDocument from 'pdfkit';

async function generateInvoicePDF(invoice) {
  const doc = new PDFDocument();
  const buffers = [];
  
  doc.on('data', buffers.push.bind(buffers));
  
  doc.fontSize(20).text(`Invoice ${invoice.invoice_number}`, 50, 50);
  doc.fontSize(12).text(`To: ${invoice.customer_name}`, 50, 100);
  doc.text(`Email: ${invoice.customer_email}`, 50, 120);
  
  let y = 180;
  doc.text('Description', 50, y);
  doc.text('Qty', 300, y);
  doc.text('Price', 400, y);
  doc.text('Amount', 500, y);
  
  invoice.line_items.forEach((item, i) => {
    y += 30;
    doc.text(item.description, 50, y);
    doc.text(item.quantity.toString(), 300, y);
    doc.text(`$${(item.unit_price / 100).toFixed(2)}`, 400, y);
    doc.text(`$${(item.amount / 100).toFixed(2)}`, 500, y);
  });
  
  y += 50;
  doc.text(`Total: $${(invoice.total_amount / 100).toFixed(2)}`, 400, y);
  
  doc.end();
  
  return new Promise((resolve) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
  });
}
```

Upload to S3/R2, store URL in invoice.pdf_url

---

## Module Structure

```
modules/payments/
├── routes/
│   ├── intents.post.ts
│   ├── index.get.ts
│   └── [id]/
│       ├── index.get.ts
│       └── cancel.post.ts
├── services/
│   └── payments.service.ts
├── repositories/
│   └── payments.repository.ts
└── schemas/
    └── payments.schema.ts

modules/invoices/
├── routes/
│   ├── index.get.ts
│   ├── index.post.ts
│   └── [id]/
│       ├── index.get.ts
│       ├── index.patch.ts
│       ├── send.post.ts
│       └── payment-link.post.ts
├── services/
│   ├── invoices.service.ts
│   └── pdf-generator.service.ts
└── repositories/
    └── invoices.repository.ts

modules/refunds/
├── routes/
│   ├── index.get.ts
│   └── index.post.ts
├── services/
│   └── refunds.service.ts
└── repositories/
    └── refunds.repository.ts
```

---

## Key Implementation Notes

1. **All amounts in cents** - Never use floats for money
2. **Application fee** - Calculate as: `Math.round(amount * 0.029) + 30` (2.9% + $0.30)
3. **Stripe account context** - Always pass `{ stripeAccount: connected_account.stripe_account_id }`
4. **Ownership validation** - Always check `organization_id` matches session
5. **Invoice numbers** - Format: `INV-YYYY-NNNN`, use sequence per year
6. **Payment intent idempotency** - Use `idempotency_key` for retries
7. **PDF storage** - Upload to cloud storage, store URL not binary
8. **Webhook idempotency** - Already handled in Phase 1 webhook_events table

---

## Success Criteria

- [ ] Create payment intents with application fees
- [ ] Process payments via Stripe Elements
- [ ] Webhooks update payment status
- [ ] Create and list invoices
- [ ] Generate invoice PDFs
- [ ] Create payment links for invoices
- [ ] Process refunds
- [ ] All data queryable by organization
