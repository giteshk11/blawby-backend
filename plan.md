# Team Payments Implementation Plan

## Overview

This document outlines the implementation plan for team payments functionality in the TypeScript Fastify application, based on the existing Laravel implementation in `/Users/giteshkhurani/Projects/blawby`.

## Current Laravel Implementation Analysis

### Key Components Found:

1. **TeamCustomPayment Model** - Core payment entity
2. **TeamCustomPaymentController** - API endpoints for payment processing
3. **Stripe Integration** - Payment intent creation and management
4. **Receipt System** - Email receipts for customers and teams
5. **Webhook Processing** - Stripe webhook handling for payment updates

### Database Schema (Laravel):

```sql
team_custom_payments:
- id (primary key)
- ulid (unique identifier)
- team_id (foreign key to teams)
- connected_account_id (foreign key to stripe_connected_accounts)
- amount (bigInteger - amount in cents)
- application_fee (bigInteger - platform fee in cents)
- currency (string, default 'usd')
- status (string - payment status)
- stripe_payment_intent_id (unique)
- stripe_charge_id (unique, nullable)
- metadata (json - additional payment details)
- timestamps
```

## Implementation Plan

### Phase 1: Database Schema & Models

**Files to create/modify:**

- `src/modules/billing/schemas/billing.schema.ts` - Add team payment tables
- `src/database/migrations/` - Create migration files
- `src/modules/billing/repositories/team-payment.repository.ts` - Database operations

**Schema additions:**

```typescript
// Team custom payments table
export const teamCustomPayments = pgTable('team_custom_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  ulid: text('ulid').notNull().unique(),
  teamId: text('team_id')
    .notNull()
    .references(() => organization.id),
  connectedAccountId: uuid('connected_account_id')
    .notNull()
    .references(() => stripeConnectedAccounts.id),
  amount: integer('amount').notNull(), // Amount in cents
  applicationFee: integer('application_fee'), // Platform fee in cents
  currency: text('currency').default('usd').notNull(),
  status: text('status'), // 'pending', 'succeeded', 'failed', 'canceled'
  stripePaymentIntentId: text('stripe_payment_intent_id').notNull().unique(),
  stripeChargeId: text('stripe_charge_id').unique(),
  metadata: json('metadata'), // Additional payment details
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Phase 2: Service Layer

**Files to create:**

- `src/modules/billing/services/team-payment.service.ts` - Business logic
- `src/modules/billing/services/stripe-team-payment.service.ts` - Stripe integration

**Key functions:**

```typescript
// Core service functions
export const createTeamPaymentIntent = async (data: CreateTeamPaymentDto, user: User, fastify: FastifyInstance)
export const updateTeamPaymentIntent = async (data: UpdateTeamPaymentDto, user: User, fastify: FastifyInstance)
export const getTeamPaymentStatus = async (paymentIntentId: string, user: User, fastify: FastifyInstance)
export const listTeamPayments = async (organizationId: string, user: User, fastify: FastifyInstance)

// Stripe integration functions
export const createStripeTeamPaymentIntent = async (data: CreateTeamPaymentDto, connectedAccountId: string)
export const updateStripePaymentIntent = async (paymentIntentId: string, amount: number)
export const retrieveStripePaymentIntent = async (paymentIntentId: string)
```

### Phase 3: API Routes

**Files to create:**

- `src/modules/billing/routes/team-payments/index.get.ts` - List team payments
- `src/modules/billing/routes/team-payments/index.post.ts` - Create payment intent
- `src/modules/billing/routes/team-payments/[id]/status.get.ts` - Get payment status
- `src/modules/billing/routes/team-payments/[id]/update.put.ts` - Update payment amount
- `src/modules/billing/routes/team-payments/public/[slug]/index.get.ts` - Public payment form
- `src/modules/billing/routes/team-payments/public/[slug]/create.post.ts` - Public payment creation

**Route structure:**

```
/api/billing/team-payments/
├── GET    /                           - List team payments (protected)
├── POST   /                           - Create payment intent (protected)
├── GET    /:id/status                 - Get payment status (protected)
├── PUT    /:id/update                 - Update payment amount (protected)
└── public/
    ├── GET    /:slug                  - Public payment form
    └── POST   /:slug/create           - Create payment (public)
```

### Phase 4: Webhook Processing

**Files to create/modify:**

- `src/modules/billing/services/webhook.service.ts` - Webhook processing
- `src/modules/billing/routes/webhooks/stripe.post.ts` - Stripe webhook endpoint

**Webhook events to handle:**

- `payment_intent.succeeded` - Update payment status and send receipts
- `payment_intent.payment_failed` - Update payment status
- `payment_intent.canceled` - Update payment status

### Phase 5: Email & Receipt System

**Files to create:**

- `src/modules/billing/services/email.service.ts` - Email sending
- `src/modules/billing/templates/team-payment-receipt.ts` - Receipt templates
- `src/modules/billing/data-objects/team-payment-receipt-data.ts` - Receipt data structure

**Email types:**

- Customer payment receipt
- Team payment notification
- Payment failure notification

### Phase 6: Validation & Types

**Files to create:**

- `src/modules/billing/schemas/team-payment.schema.ts` - Zod validation schemas
- `src/modules/billing/types/team-payment.types.ts` - TypeScript types
- `src/shared/validations/team-payment.ts` - Validation functions

**Key types:**

```typescript
export type CreateTeamPaymentRequest = {
  organizationId: string;
  amount: number;
  email: string;
  name: string;
  onBehalfOf?: string;
};

export type UpdateTeamPaymentRequest = {
  paymentId: string;
  amount: number;
};

export type TeamPaymentStatus = 'pending' | 'succeeded' | 'failed' | 'canceled';
```

### Phase 7: Integration with Existing Systems

**Files to modify:**

- `src/modules/billing/services/billing.service.ts` - Add team payment methods
- `src/modules/practice/services/organization.service.ts` - Add payment slug support
- `src/schema/index.ts` - Export new schemas

**Integration points:**

- Organization payment slug generation
- Stripe connected account validation
- Member role permissions for payment access

## Implementation Order

1. **Database Schema** (Phase 1) - Foundation
2. **Types & Validation** (Phase 6) - Type safety
3. **Repository Layer** (Phase 1) - Data access
4. **Service Layer** (Phase 2) - Business logic
5. **API Routes** (Phase 3) - Public interface
6. **Webhook Processing** (Phase 4) - Payment updates
7. **Email System** (Phase 5) - Notifications
8. **Integration** (Phase 7) - System integration

## Key Features to Implement

### Core Features:

- ✅ Create custom payment intents for teams
- ✅ Update payment amounts before completion
- ✅ Public payment forms with team slugs
- ✅ Payment status tracking
- ✅ Stripe webhook processing
- ✅ Email receipts for customers and teams
- ✅ Application fee calculation
- ✅ Payment metadata storage

### Security Features:

- ✅ Organization-based access control
- ✅ Member role validation
- ✅ Stripe webhook signature verification
- ✅ Input validation and sanitization
- ✅ Rate limiting on payment endpoints

### Business Features:

- ✅ Platform fee calculation
- ✅ Payment analytics and reporting
- ✅ Custom payment metadata
- ✅ Multi-currency support
- ✅ Payment method flexibility (cards, bank accounts)

## Testing Strategy

### Unit Tests:

- Service layer functions
- Validation schemas
- Repository operations
- Email templates

### Integration Tests:

- API endpoint testing
- Stripe integration testing
- Webhook processing
- Database operations

### End-to-End Tests:

- Complete payment flow
- Error handling scenarios
- Email delivery
- Webhook processing

## Migration from Laravel

### Data Migration:

- Export team custom payments from Laravel
- Transform data to match new schema
- Import into TypeScript application
- Verify data integrity

### Feature Parity:

- Ensure all Laravel features are implemented
- Maintain API compatibility where possible
- Update frontend to use new endpoints
- Test payment flows thoroughly

## Success Criteria

1. ✅ All team payment features from Laravel are implemented
2. ✅ Payment processing works end-to-end
3. ✅ Webhook processing is reliable
4. ✅ Email receipts are sent correctly
5. ✅ Security measures are in place
6. ✅ Performance meets requirements
7. ✅ Code follows project standards
8. ✅ Tests provide good coverage

## Timeline Estimate

- **Phase 1-2**: 2-3 days (Database & Services)
- **Phase 3**: 2-3 days (API Routes)
- **Phase 4**: 1-2 days (Webhooks)
- **Phase 5**: 1-2 days (Email System)
- **Phase 6**: 1 day (Types & Validation)
- **Phase 7**: 1-2 days (Integration)
- **Testing**: 2-3 days
- **Total**: 10-15 days

## Notes

- Follow existing project patterns and conventions
- Use full path aliases for imports (`@/`, `features/`)
- Implement proper error handling and logging
- Ensure TypeScript strict mode compliance
- Follow Fastify best practices
- Maintain consistency with existing billing module
