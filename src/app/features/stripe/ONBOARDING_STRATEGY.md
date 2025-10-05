# Stripe Connected Account Onboarding Strategy (API-Driven)

## Overview

This document outlines the strategy for implementing Stripe connected account onboarding using **Stripe's embedded components** for organizations and users in our **API-driven application**. Based on the Blawby repository analysis and our existing codebase, we'll implement a proven approach that enables users to explore the app first, then seamlessly upgrade to business accounts through Stripe Connect's embedded onboarding flow.

## Current Codebase Analysis

### ✅ What We Already Have:

1. **Stripe Service Layer**: Complete `StripeService` with account creation, sessions, and webhook handling
2. **Organization Onboarding Service**: `OrganizationOnboardingService` with session management
3. **Database Schema**: Complete Stripe schemas for connected accounts, customers, subscriptions, etc.
4. **API Endpoints**: Existing endpoints for connected accounts and onboarding
5. **Webhook System**: Event-driven webhook processing with `stripe-webhook-events.ts`
6. **Validation Schemas**: Comprehensive Zod schemas for all Stripe entities
7. **Functional Queries**: Database queries using functional pattern (no classes)

### 🔧 What Needs Enhancement:

1. **Embedded Components Support**: Add Account Session creation for embedded onboarding
2. **Multi-Organization Support**: Separate Stripe accounts for each organization
3. **Role-Based Access**: Only owners/admins can create practice accounts
4. **Status Tracking**: Enhanced webhook handling for embedded component events
5. **API Endpoints**: Additional endpoints for embedded onboarding flow

### 🏢 Multi-Organization Stripe Account Strategy:

**Why Separate Accounts Per Organization:**

- ✅ **Legal Separation**: Each law firm/practice is a separate legal entity
- ✅ **Financial Separation**: Different bank accounts, tax IDs, business info
- ✅ **Compliance**: Each organization needs its own Stripe verification
- ✅ **Billing**: Separate invoicing and payment processing per practice
- ✅ **Reporting**: Individual financial reports per organization

**Database Structure:**

```typescript
// Each organization gets its own Stripe connected account
stripeConnectedAccounts = {
  id: uuid,
  stripeAccountId: text, // Unique Stripe account per organization
  entityType: 'organization',
  entityId: organizationId, // Links to Better Auth organization
  businessType: 'company', // Practices are companies
  // ... other fields
};

// Practice-specific business details (separate table)
practiceDetails = {
  id: uuid,
  organizationId: text, // References Better Auth organization.id
  businessPhone: text,
  businessEmail: text,
  consultationFee: text,
  paymentUrl: text,
  calendlyUrl: text,
  createdAt: timestamp,
  updatedAt: timestamp,
};

// Organization settings (unchanged, existing)
organizationSettings = {
  organizationId: text, // References Better Auth organization.id
  general: {
    name: string, // Used for business_name
    website: string, // Used for website_url
    logo: string, // Used for logo
    // ... other existing fields
  },
  // ... other existing settings
};
```

**User Experience:**

- User switches between organizations in Better Auth
- Each organization can have its own Stripe onboarding status
- User can onboard multiple practices independently
- Clear separation of financial data per organization

### 📋 Practice Business Details Strategy:

**Based on Blawby's BusinessInfo Component:**

```typescript
// Blawby's business details fields:
{
  business_name: string,      // Required
  business_phone: string,     // Required
  business_email: string,     // Required
  website_url?: string,       // Optional
  logo?: File,               // Optional
}
```

**Integration with Existing Organization Settings:**

```typescript
// We already have these in organizationSettings.general:
{
  name?: string,        // Maps to business_name
  website?: string,     // Maps to website_url
  logo?: string,       // Maps to logo
}

// We need to add these practice-specific fields:
{
  businessPhone?: string,    // New field
  businessEmail?: string,   // New field
  consultationFee?: string, // New field (from Blawby)
  paymentUrl?: string,      // New field (from Blawby)
  calendlyUrl?: string,     // New field (from Blawby)
}
```

**Recommended Approach:**

1. **Leverage Existing**: Use `organizationSettings.general` for name, website, logo
2. **Separate Practice Details**: Create dedicated `practiceDetails` table for practice-specific fields
3. **No Pollution**: Keep organization settings clean and unchanged
4. **Single Source**: Practice details in dedicated table (not duplicate)
5. **Stripe Integration**: Combine both tables to pre-fill Stripe onboarding when possible

## Current State Analysis

### Existing Infrastructure

- ✅ Stripe service integration with webhook handling
- ✅ Database schema for connected accounts (`stripeConnectedAccounts`)
- ✅ Organization-based access control via Better Auth
- ✅ Functional database queries for connected accounts
- ✅ Validation schemas for Stripe entities
- ✅ API endpoints for connected account management

### Current Connected Account Schema

```typescript
stripeConnectedAccounts = {
  id: uuid,
  stripeAccountId: text,
  businessType: text, // 'individual' | 'company'
  type: text, // 'express' | 'standard' | 'custom'
  country: text,
  email: text,
  chargesEnabled: boolean,
  payoutsEnabled: boolean,
  detailsSubmitted: boolean,
  entityType: text, // 'organization' | 'user'
  entityId: uuid, // organization or user ID
  // ... other fields
};
```

## Practice Onboarding Strategy (API-Driven)

### 1. Practice Flow (API-Driven)

```
Frontend App → API Call → Create Account Session → Return Client Secret → Frontend Embeds Stripe Component
```

**Phase 1: Account Creation & Authentication** ✅

- ✅ Users register via Better Auth API (`/api/auth/sign-up`)
- ✅ Users authenticate via Better Auth API (`/api/auth/sign-in`)
- ✅ Users create or join organizations via Better Auth API
- ✅ Full access to explore application features
- ✅ No immediate payment requirements

**Phase 2: Practice Upgrade Trigger**

- **Authentication Required**: User must be authenticated with valid session (Better Auth)
- **Organization Required**: User must be part of an organization (Better Auth)
- **Role Required**: Only organization owners/admins can create practice accounts
- Frontend calls API to initiate practice onboarding for specific organization
- API validates user authentication, organization membership, and role via Better Auth
- **API creates separate Stripe connected account for each organization**
- API creates Account Session for the organization's Stripe account
- Returns `client_secret` for embedded components

**Phase 3: Embedded Onboarding (Frontend)**

- Frontend uses `client_secret` to load Stripe embedded component
- User completes practice onboarding within frontend app
- Webhook events update API database

**Phase 4: Post-Onboarding Activation**

- API webhooks mark onboarding complete
- Practice features automatically enabled
- Frontend receives status updates

### 2. API Endpoints Strategy

#### Enhanced Practice Onboarding Endpoints

```typescript
// POST /api/practice/onboard
// Creates Stripe account and Account Session for practice onboarding
// Requires: Authentication + Organization membership
// Headers: Authorization: Bearer <session_token>
{
  "organizationId": "org_123" // Optional: defaults to user's active organization
}

// Response
{
  "accountId": "acct_123",
  "clientSecret": "acs_client_secret_123",
  "accountSessionId": "acsess_123",
  "isNewAccount": true
}
```

#### Status Tracking Endpoints

```typescript
// GET /api/practice/onboarding-status/:organizationId
// Returns current onboarding status
{
  "hasAccount": true,
  "onboardingComplete": false,
  "chargesEnabled": false,
  "payoutsEnabled": false,
  "requirements": {...},
  "capabilities": {...}
}
```

#### Embedded Component Support

```typescript
// POST /api/practice/refresh-session/:organizationId
// Refreshes expired Account Session
{
  "clientSecret": "acs_client_secret_new_123"
}

// GET /api/practice/dashboard-link/:organizationId
// Creates dashboard login link
{
  "url": "https://connect.stripe.com/express/accounts/acct_123/login"
}
```

### 3. Blawby-Inspired Embedded Onboarding Process

#### Step 1: Upgrade Initiation

1. User clicks "Upgrade to Business" button
2. System creates Stripe Express account with specific capabilities
3. Generate Account Session with `account_onboarding` component enabled
4. Store account details in database

#### Step 2: Embedded Onboarding Flow (Based on Blawby)

```typescript
// Blawby's proven approach
const stripeConnectInstance = loadConnectAndInitialize({
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  fetchClientSecret: () => Promise.resolve(accountSession.client_secret),
});

const stripeComponent = stripeConnectInstance.create('account-onboarding');
stripeComponent.setOnExit(() => {
  // Handle user exit gracefully
  checkAccountStatus();
});
```

#### Step 3: Status Monitoring & Webhook Integration

1. Monitor `account.updated` webhook events
2. Update `details_submitted` status in database
3. Mark onboarding step as completed
4. Handle account capabilities and requirements

#### Step 4: Post-Onboarding Activation

1. Verify `details_submitted` status
2. Enable business features automatically
3. Create subscription and usage events
4. Provide embedded dashboard access

## Technical Implementation Plan

### 1. Database Schema Enhancements

#### Add Missing Fields

```typescript
// Add to stripeConnectedAccounts schema
status: text('status').default('pending'), // 'pending' | 'active' | 'restricted' | 'rejected'
onboardingStatus: text('onboarding_status'), // Stripe's onboarding status
requirements: json('requirements'), // Stripe requirements object
capabilities: json('capabilities'), // Stripe capabilities object
```

#### Add Onboarding Tracking Table

```typescript
export const stripeOnboardingSessions = pgTable('stripe_onboarding_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  connectedAccountId: uuid('connected_account_id').notNull(),
  sessionId: text('session_id').notNull().unique(),
  status: text('status').default('pending'), // 'pending' | 'completed' | 'expired' | 'failed'
  expiresAt: timestamp('expires_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
```

### 2. API Endpoints Design

#### Business Account Onboarding Endpoints

```
POST /api/business/onboard
- Create Stripe account and Account Session
- Return Account Session for embedded components
- Prefill with user data

GET /api/business/onboarding-status
- Get current onboarding status
- Return requirements and capabilities
- Real-time progress updates

POST /api/business/refresh-session
- Refresh expired Account Session
- Generate new session for embedded components

GET /api/business/dashboard-link
- Generate Stripe dashboard login link
- Return dashboard URL for embedded access

POST /api/business/complete-onboarding
- Handle onboarding completion
- Activate business features
- Send welcome notifications
```

#### Embedded Component Endpoints

```
GET /api/business/embedded-config
- Return configuration for embedded components
- Include branding and customization options

POST /api/business/webhook/account-updated
- Handle Stripe webhook events
- Update local account status
- Trigger real-time UI updates
```

### 3. Service Layer Architecture

#### Enhanced PracticeOnboardingService (API-Driven)

```typescript
// Extend existing OrganizationOnboardingService for practice onboarding
class PracticeOnboardingService extends OrganizationOnboardingService {
  // Create onboarding session for practices (API-driven)
  async createPracticeOnboardingSession(
    userId: string,
    organizationId?: string,
  ): Promise<OnboardingSessionResponse> {
    // Validate user authentication (Better Auth integration)
    const user = await this.validateUserAuthentication(userId);
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Handle multiple organizations and active organization switching
    let targetOrganizationId: string;

    if (organizationId) {
      // User explicitly specified an organization
      targetOrganizationId = organizationId;
    } else {
      // Use user's active organization from Better Auth session
      targetOrganizationId = user.activeOrganizationId;
    }

    if (!targetOrganizationId) {
      throw new Error(
        'User must have an active organization or specify organizationId',
      );
    }

    // Validate organization membership and access
    const hasAccess = await this.validateOrganizationAccess(
      userId,
      targetOrganizationId,
    );
    if (!hasAccess) {
      throw new Error('User does not have access to this organization');
    }

    // Check if user has permission to create Stripe account for this organization
    const userRole = await this.getUserRoleInOrganization(
      userId,
      targetOrganizationId,
    );
    if (!['owner', 'admin'].includes(userRole)) {
      throw new Error(
        'Only organization owners and admins can create practice accounts',
      );
    }

    // Check if organization already has a connected account
    let connectedAccount =
      await getConnectedAccountByEntityId(targetOrganizationId);
    let isNewAccount = false;

    if (!connectedAccount) {
      // Create NEW Stripe connected account for this specific organization
      // Each organization gets its own separate Stripe account
      const stripeAccount =
        await this.stripeService.createAdvancedConnectedAccount();

      // Save to database - this creates a unique Stripe account per organization
      connectedAccount = await createConnectedAccount({
        stripeAccountId: stripeAccount.id, // Unique Stripe account ID
        type: 'express',
        country: 'US', // Default, Stripe will handle country selection
        email: '', // Stripe will collect this
        businessType: 'company', // Practices are companies
        entityType: 'organization',
        entityId: targetOrganizationId, // Links to specific Better Auth organization
        chargesEnabled: stripeAccount.charges_enabled || false,
        payoutsEnabled: stripeAccount.payouts_enabled || false,
        detailsSubmitted: stripeAccount.details_submitted || false,
      });

      isNewAccount = true;
    }

    // Get organization settings and practice details for pre-filling Stripe onboarding
    const orgSettings =
      await this.getOrganizationSettings(targetOrganizationId);
    const practiceDetails = await this.getPracticeDetails(targetOrganizationId);

    // Create Account Session for embedded onboarding with pre-filled data
    const accountSession = await this.stripeService.createAccountSession(
      connectedAccount.stripeAccountId,
      {
        // Pre-fill with data from both tables
        business_profile: {
          name: orgSettings?.general?.name, // From org settings
          support_email: practiceDetails?.businessEmail, // From practice details
          url: orgSettings?.general?.website, // From org settings
        },
        // Additional practice-specific data
        business_type: 'company',
        country: 'US', // Default, user can change in Stripe
      },
    );

    return {
      accountId: connectedAccount.stripeAccountId,
      clientSecret: accountSession.client_secret!,
      accountSessionId: accountSession.id,
      onboardingUrl: '', // Not needed for embedded
      refreshUrl: `${process.env.API_URL}/api/practice/refresh-session/${targetOrganizationId}`,
      returnUrl: `${process.env.FRONTEND_URL}/practice/success`,
      isNewAccount,
    };
  }

  // Helper methods for authentication validation
  private async validateUserAuthentication(userId: string) {
    // Integration with Better Auth to validate user session
    // This would check if the user is properly authenticated
    return await this.betterAuthService.getUser(userId);
  }

  private async validateOrganizationAccess(
    userId: string,
    organizationId: string,
  ) {
    // Check if user has access to the organization
    return await this.betterAuthService.canAccessOrganization(
      userId,
      organizationId,
    );
  }

  private async getUserRoleInOrganization(
    userId: string,
    organizationId: string,
  ): Promise<string> {
    // Get user's role in the organization (owner, admin, member)
    return await this.betterAuthService.getUserRoleInOrganization(
      userId,
      organizationId,
    );
  }

  private async getOrganizationSettings(organizationId: string) {
    // Get organization settings for pre-filling Stripe onboarding
    return await this.settingsService.getOrganizationSettings(organizationId);
  }

  // Get onboarding status for practices
  async getPracticeOnboardingStatus(organizationId: string) {
    const connectedAccount =
      await getConnectedAccountByEntityId(organizationId);

    if (!connectedAccount) {
      return {
        hasAccount: false,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        requirements: null,
        capabilities: null,
      };
    }

    // Get fresh data from Stripe
    const stripeAccount = await this.stripeService.getConnectedAccountDetails(
      connectedAccount.stripeAccountId,
    );

    // Update local data
    await updateConnectedAccount(connectedAccount.id, {
      chargesEnabled: stripeAccount.charges_enabled || false,
      payoutsEnabled: stripeAccount.payouts_enabled || false,
      detailsSubmitted: stripeAccount.details_submitted || false,
      company: stripeAccount.company as any,
      individual: stripeAccount.individual as any,
      requirements: stripeAccount.requirements as any,
      capabilities: stripeAccount.capabilities as any,
    });

    return {
      hasAccount: true,
      accountId: connectedAccount.stripeAccountId,
      onboardingComplete: stripeAccount.details_submitted || false,
      chargesEnabled: stripeAccount.charges_enabled || false,
      payoutsEnabled: stripeAccount.payouts_enabled || false,
      requirements: stripeAccount.requirements,
      capabilities: stripeAccount.capabilities,
      account: connectedAccount,
    };
  }

  // Refresh Account Session for embedded components
  async refreshPracticeAccountSession(
    organizationId: string,
  ): Promise<AccountSession> {
    const connectedAccount =
      await getConnectedAccountByEntityId(organizationId);

    if (!connectedAccount) {
      throw new Error('No connected account found for practice');
    }

    return await this.stripeService.createAccountSession(
      connectedAccount.stripeAccountId,
    );
  }
}
```

### 4. Frontend Integration (API-Driven)

#### Frontend Implementation Pattern

```typescript
// Frontend calls API to get Account Session
const initializeOnboarding = async () => {
  try {
    // Ensure user is authenticated
    if (!currentUser || !currentUser.sessionToken) {
      throw new Error('User must be authenticated');
    }

    // Call our API to create Account Session
    const response = await fetch('/api/practice/onboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentUser.sessionToken}`,
      },
      body: JSON.stringify({
        organizationId: selectedOrganization?.id, // Optional: defaults to user's active org
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 401) {
        // Redirect to login
        window.location.href = '/login';
        return;
      }
      if (response.status === 403) {
        // Show organization access error
        if (error.error.includes('owners and admins')) {
          showError(
            'Only organization owners and admins can create practice accounts',
          );
        } else if (error.error.includes('Access denied')) {
          showError('You do not have access to this organization');
        } else {
          showError('You must be part of an organization to create a practice');
        }
        return;
      }
      if (response.status === 400) {
        // Show organization selection error
        showError(
          'Please select an organization or ensure you have an active organization',
        );
        return;
      }
      throw new Error(error.error || 'Failed to create onboarding session');
    }

    const { clientSecret, accountId } = await response.json();

    // Use Stripe Connect JS with our API's client secret
    const stripeConnectInstance = loadConnectAndInitialize({
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      fetchClientSecret: () => Promise.resolve(clientSecret),
    });

    const stripeComponent = stripeConnectInstance.create('account-onboarding');

    // Handle completion
    stripeComponent.setOnExit(() => {
      // Call API to check status
      checkOnboardingStatus();
    });

    // Mount component
    const container = document.getElementById('onboarding-container');
    container.appendChild(stripeComponent);
  } catch (error) {
    console.error('Error initializing onboarding:', error);
    showError('Failed to initialize practice onboarding');
  }
};

// Check onboarding status via API
const checkOnboardingStatus = async () => {
  const response = await fetch(
    `/api/practice/onboarding-status/${currentOrganization.id}`,
  );
  const status = await response.json();

  if (status.onboardingComplete) {
    // Show success state
    showOnboardingComplete();
  } else {
    // Show processing state
    showProcessingState();
  }
};
```

#### API Endpoint Implementation

```typescript
// New API endpoints to add to connected-accounts.ts
export default fastifyPlugin(async (fastify: FastifyInstance) => {
  const practiceOnboardingService = new PracticeOnboardingService();

  // POST /api/practice/onboard
  fastify.post('/api/practice/onboard', async (request, reply) => {
    try {
      // Extract user ID from Better Auth session
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const body = z
        .object({
          organizationId: z.string().min(1).optional(),
        })
        .parse(request.body);

      // Get user's active organization from Better Auth session
      const activeOrganizationId =
        BetterAuthIntegration.getActiveOrganizationId(request);

      const session =
        await practiceOnboardingService.createPracticeOnboardingSession(
          userId,
          body.organizationId || activeOrganizationId,
        );

      return { data: session };
    } catch (error) {
      fastify.log.error(
        'Error creating practice onboarding session:',
        undefined,
        error,
      );

      if (error.message.includes('not authenticated')) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      if (error.message.includes('must be part of an organization')) {
        return reply
          .status(403)
          .send({ error: 'Organization membership required' });
      }
      if (error.message.includes('does not have access')) {
        return reply
          .status(403)
          .send({ error: 'Access denied to organization' });
      }
      if (error.message.includes('Only organization owners and admins')) {
        return reply.status(403).send({
          error:
            'Only organization owners and admins can create practice accounts',
        });
      }
      if (error.message.includes('must have an active organization')) {
        return reply.status(400).send({
          error:
            'User must have an active organization or specify organizationId',
        });
      }

      reply.status(500).send({ error: 'Failed to create onboarding session' });
    }
  });

  // GET /api/practice/onboarding-status/:organizationId
  fastify.get(
    '/api/practice/onboarding-status/:organizationId',
    async (request, reply) => {
      try {
        const { organizationId } = request.params as { organizationId: string };

        const status =
          await practiceOnboardingService.getPracticeOnboardingStatus(
            organizationId,
          );

        return { data: status };
      } catch (error) {
        fastify.log.error('Error getting onboarding status:', undefined, error);
        reply.status(500).send({ error: 'Failed to get onboarding status' });
      }
    },
  );

  // POST /api/practice/refresh-session/:organizationId
  fastify.post(
    '/api/practice/refresh-session/:organizationId',
    async (request, reply) => {
      try {
        const { organizationId } = request.params as { organizationId: string };

        const session =
          await practiceOnboardingService.refreshPracticeAccountSession(
            organizationId,
          );

        return { data: { clientSecret: session.client_secret } };
      } catch (error) {
        fastify.log.error('Error refreshing session:', undefined, error);
        reply.status(500).send({ error: 'Failed to refresh session' });
      }
    },
  );
});
```

#### Upgrade Button Integration

```typescript
// Upgrade prompt component
const UpgradePrompt = () => {
  const handleUpgrade = async () => {
    // Navigate to embedded onboarding
    router.push('/business/onboard');
  };

  return (
    <div className="upgrade-prompt">
      <h2>Unlock Business Features</h2>
      <p>Accept payments, manage customers, and grow your business</p>
      <button onClick={handleUpgrade} className="upgrade-button">
        Upgrade to Business Account
      </button>
    </div>
  );
};
```

### 5. Webhook Event Handling

#### Key Events to Handle

```typescript
// Account lifecycle
'account.updated' → Update account status and capabilities
'capability.updated' → Update capability status
'account.application.deauthorized' → Handle deauthorization

// Onboarding specific
'account.application.authorized' → Account approved
'person.created' → Individual account person created
'person.updated' → Person information updated

// Embedded component events
'onboarding.completed' → Handle completion
'onboarding.exited' → Handle user exit
'onboarding.error' → Handle errors
```

#### Webhook Processing Strategy

1. Verify webhook signature
2. Process event asynchronously (non-blocking)
3. Update database with new status
4. Send real-time updates to frontend
5. Log all events for debugging
6. Handle retries for failed events

### 6. User Experience Design

#### Upgrade Flow Integration

**App Navigation:**

- Upgrade button in main navigation
- Prominent placement in dashboard
- Contextual prompts throughout app
- Clear value proposition messaging

**Onboarding Experience:**

- Embedded component within app layout
- Progress indicators and status updates
- Real-time validation feedback
- Mobile-responsive design
- Accessibility compliance

**Post-Onboarding:**

- Welcome dashboard with business features
- Embedded Stripe dashboard access
- Payment analytics and insights
- Customer management tools

## Security Considerations

### 1. Access Control

- Only organization owners/admins can initiate onboarding
- Verify user permissions before account creation
- Audit all onboarding actions

### 2. Data Protection

- Encrypt sensitive account data
- Secure webhook endpoint
- Rate limiting on onboarding endpoints

### 3. Compliance

- GDPR compliance for EU users
- PCI DSS considerations
- Data retention policies

## Error Handling Strategy

### 1. Onboarding Failures

- Retry logic for transient failures
- Clear error messages for users
- Fallback to manual verification

### 2. Webhook Failures

- Dead letter queue for failed events
- Retry mechanism with exponential backoff
- Manual reconciliation process

### 3. Account Restrictions

- Handle Stripe account restrictions gracefully
- Provide clear guidance to users
- Support for account recovery

## Testing Strategy

### 1. Unit Tests

- Service layer methods
- Database query functions
- Validation schemas

### 2. Integration Tests

- API endpoint testing
- Webhook event processing
- Database operations

### 3. End-to-End Tests

- Complete onboarding flow
- Error scenarios
- Webhook processing

## Monitoring and Analytics

### 1. Metrics to Track

- Onboarding completion rate
- Time to complete onboarding
- Common failure points
- Webhook processing latency

### 2. Alerts

- Failed onboarding attempts
- Webhook processing errors
- Account restriction notifications

## Migration Strategy

### 1. Existing Data

- Audit current connected accounts
- Migrate to new schema if needed
- Handle missing fields gracefully

### 2. Rollout Plan

- Feature flag for new onboarding flow
- Gradual rollout to organizations
- Monitor and adjust based on feedback

## Future Enhancements

### 1. Multi-Currency Support

- Currency selection during onboarding
- Multi-currency account management

### 2. Advanced Verification

- Document upload handling
- Identity verification integration
- Automated compliance checks

### 3. Analytics Dashboard

- Payment analytics for organizations
- Revenue tracking
- Performance metrics

## Implementation Plan (API-Driven)

### Phase 1: Enhance Existing Services ✅

- ✅ **StripeService**: Already has `createAdvancedConnectedAccount()` and `createAccountSession()`
- ✅ **Database Schema**: Already supports organization-level connected accounts (`entityType: 'organization'`)
- ✅ **Webhook System**: Already handles `account.updated` events
- ✅ **Better Auth Integration**: User registration, authentication, and organization management
- ✅ **Organization Settings**: Already has general settings (name, website, logo)
- 🔧 **Enhance**: Add practice-specific fields to organization settings
- 🔧 **Enhance**: Add practice-level onboarding methods to `OrganizationOnboardingService`

### Phase 2: Create Practice Onboarding Service

- 🔧 **Create**: `PracticeOnboardingService` extending existing service
- 🔧 **Add**: Organization-level onboarding methods
- 🔧 **Add**: Account Session refresh functionality
- 🔧 **Add**: Status checking methods

### Phase 3: Add API Endpoints

- 🔧 **Add**: `POST /api/practice/onboard` - Create practice onboarding session
- 🔧 **Add**: `GET /api/practice/onboarding-status/:organizationId` - Get status
- 🔧 **Add**: `POST /api/practice/refresh-session/:organizationId` - Refresh session
- 🔧 **Add**: `GET /api/practice/dashboard-link/:organizationId` - Dashboard access

### Phase 4: Enhance Webhook Handling

- 🔧 **Enhance**: `account.updated` webhook to handle organization accounts
- 🔧 **Add**: Onboarding completion detection
- 🔧 **Add**: Automatic practice feature activation

### Phase 5: Frontend Integration (Client-Side)

- 🔧 **Frontend**: Call API to get `client_secret`
- 🔧 **Frontend**: Use Stripe Connect JS with embedded components
- 🔧 **Frontend**: Handle completion and status checking
- 🔧 **Frontend**: Show progress and success states

## Key Implementation Decisions

### 1. Embedded Components Strategy ✅

- **Decision**: Use Stripe's embedded components for seamless onboarding
- **Rationale**: Better user experience, reduced abandonment, consistent branding
- **Implementation**: Account Sessions + embedded onboarding component

### 2. User Flow Design ✅

- **Decision**: Allow exploration first, then upgrade to business
- **Rationale**: Users understand value before committing to payment setup
- **Implementation**: Prominent upgrade buttons throughout app

### 3. Account Type Selection ✅

- **Decision**: Default to Express accounts for simplicity
- **Rationale**: Faster onboarding, easier compliance, better conversion
- **Implementation**: Express accounts with embedded components

### 4. Data Prefilling Strategy ✅

- **Decision**: Prefill onboarding with known user data
- **Rationale**: Reduces friction, improves completion rates
- **Implementation**: Pass user profile data to embedded components

## Questions for Discussion

1. **Upgrade Button Placement**: Where should we place upgrade prompts for maximum conversion?

2. **Onboarding Progress**: How should we show real-time progress during embedded onboarding?

3. **Error Recovery**: How should we handle users who exit onboarding mid-process?

4. **Mobile Experience**: Any specific considerations for mobile embedded components?

5. **Analytics Integration**: What metrics should we track for embedded onboarding success?

6. **A/B Testing**: Should we test different upgrade prompts or onboarding flows?

7. **Support Integration**: How should we provide help during embedded onboarding?

8. **Post-Onboarding**: What features should we highlight immediately after completion?

## Next Steps

1. **Review Strategy**: Approve embedded components approach and user flow
2. **Database Schema**: Implement enhanced schema with onboarding tracking
3. **Service Layer**: Build BusinessOnboardingService with embedded support
4. **API Endpoints**: Create business onboarding endpoints
5. **Frontend Components**: Implement embedded onboarding components
6. **Webhook Integration**: Handle embedded component events
7. **Testing**: Test embedded components in Stripe sandbox
8. **Deployment**: Gradual rollout with feature flags

---

_This document should be reviewed and updated as the implementation progresses and requirements evolve._
