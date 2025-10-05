# Stripe Connected Account Onboarding

This document explains how to use the new Stripe connected account onboarding system integrated with Better Auth organizations.

## Overview

The system provides a complete onboarding flow for organizations to set up Stripe Connect accounts, enabling them to receive payments through your platform.

## API Endpoints

### 1. Create Onboarding Session

**POST** `/api/stripe/account-sessions/onboarding`

Creates a new onboarding session for an organization or retrieves an existing one.

#### Request Body

```typescript
{
  organizationId: string;           // Required: Better Auth organization ID
  organizationName?: string;        // Optional: Organization name for pre-filling
  organizationEmail?: string;       // Optional: Organization email for pre-filling
  country?: string;                 // Optional: Country code (default: "US")
  refreshUrl?: string;              // Optional: URL to redirect on refresh
  returnUrl?: string;               // Optional: URL to redirect on completion
}
```

#### Response

```typescript
{
  data: {
    accountId: string; // Stripe account ID
    clientSecret: string; // Client secret for Stripe.js
    accountSessionId: string; // Account session ID
    onboardingUrl: string; // Direct onboarding URL
    refreshUrl: string; // Refresh URL
    returnUrl: string; // Return URL
    isNewAccount: boolean; // Whether this is a new account
  }
}
```

#### Example Usage

```bash
curl -X POST http://localhost:3000/api/stripe/account-sessions/onboarding \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "org_123",
    "organizationName": "My Company",
    "organizationEmail": "admin@mycompany.com",
    "country": "US",
    "refreshUrl": "https://myapp.com/dashboard/stripe/refresh",
    "returnUrl": "https://myapp.com/dashboard/stripe/success"
  }'
```

### 2. Get Onboarding Status

**GET** `/api/stripe/organizations/:organizationId/onboarding-status`

Retrieves the current onboarding status for an organization.

#### Response

```typescript
{
  data: {
    hasAccount: boolean;            // Whether organization has a Stripe account
    accountId?: string;             // Stripe account ID (if exists)
    onboardingComplete: boolean;    // Whether onboarding is complete
    chargesEnabled: boolean;        // Whether charges are enabled
    payoutsEnabled: boolean;        // Whether payouts are enabled
    requirements?: object;          // Stripe requirements object
    capabilities?: object;          // Stripe capabilities object
    account?: object;               // Local account data
  }
}
```

#### Example Usage

```bash
curl http://localhost:3000/api/stripe/organizations/org_123/onboarding-status
```

### 3. Create Payments Session

**POST** `/api/stripe/organizations/:organizationId/payments-session`

Creates a payments session for managing payments after onboarding is complete.

#### Response

```typescript
{
  data: {
    client_secret: string; // Client secret for Stripe.js
    id: string; // Session ID
  }
}
```

### 4. Create Login Link

**POST** `/api/stripe/organizations/:organizationId/login-link`

Creates a login link for accessing the Stripe Dashboard.

#### Response

```typescript
{
  data: {
    url: string; // Login URL
  }
}
```

## Frontend Integration

### Using Stripe.js

```typescript
import { loadStripe } from '@stripe/stripe-js';

const stripe = await loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

// Create onboarding session
const response = await fetch('/api/stripe/account-sessions/onboarding', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    organizationId: 'org_123',
    organizationName: 'My Company',
    organizationEmail: 'admin@mycompany.com',
  }),
});

const { data } = await response.json();

// Initialize Stripe Connect
const { error } = await stripe.initConnect({
  clientSecret: data.clientSecret,
});

if (error) {
  console.error('Error initializing Stripe Connect:', error);
}
```

### Using Direct URL

```typescript
// Redirect directly to onboarding
window.location.href = data.onboardingUrl;
```

## Webhook Handling

The system automatically handles Stripe webhooks to update account status:

- `account.updated` - Updates account capabilities and requirements
- `account.application.deauthorized` - Handles account deauthorization
- `capability.updated` - Updates account capabilities

## Database Schema

The system uses the `stripe_connected_accounts` table to store account information:

```sql
CREATE TABLE stripe_connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_account_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  country TEXT NOT NULL,
  email TEXT NOT NULL,
  business_type TEXT,
  charges_enabled BOOLEAN DEFAULT FALSE NOT NULL,
  payouts_enabled BOOLEAN DEFAULT FALSE NOT NULL,
  details_submitted BOOLEAN DEFAULT FALSE NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  -- ... other fields
);
```

## Error Handling

All endpoints return consistent error responses:

```typescript
{
  error: string; // Error message
}
```

Common error scenarios:

- Organization not found
- Stripe API errors
- Invalid parameters
- Onboarding not complete (for payments session)

## Security Considerations

1. **Authentication**: Ensure users can only access their organization's data
2. **Rate Limiting**: Implement rate limiting on onboarding endpoints
3. **Webhook Verification**: Always verify Stripe webhook signatures
4. **Data Validation**: Validate all input parameters using Zod schemas

## Testing

Use Stripe's test mode for development:

```bash
# Set test keys in environment
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Test webhook events can be sent using Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```


