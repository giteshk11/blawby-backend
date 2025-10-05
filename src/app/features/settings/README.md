# Settings API Documentation

This document describes the comprehensive settings system that integrates with Better Auth for both user and organization settings management.

## Overview

The settings system provides:

- **User Settings**: Personal preferences, profile, and privacy settings
- **Organization Settings**: General, notifications, billing, security, integrations, and features
- **Settings History**: Audit trail for all changes
- **Better Auth Integration**: Seamless authentication and authorization
- **Type Safety**: Full TypeScript support with Zod validation

## Database Schema

### User Settings Table

```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE, -- References Better Auth user.id
  preferences JSON, -- Theme, language, notifications, etc.
  profile JSON, -- Bio, website, social links, etc.
  privacy JSON, -- Visibility settings, etc.
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);
```

### Organization Settings Table

```sql
CREATE TABLE organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL UNIQUE, -- References Better Auth organization.id
  general JSON, -- Name, description, timezone, etc.
  notifications JSON, -- Email, Slack, webhooks, etc.
  billing JSON, -- Stripe, subscription, billing address, etc.
  security JSON, -- 2FA, session timeout, password policy, etc.
  integrations JSON, -- Stripe, Slack, GitHub, etc.
  features JSON, -- Feature flags, limits, etc.
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);
```

### Settings History Table

```sql
CREATE TABLE settings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'user' or 'organization'
  entity_id TEXT NOT NULL,
  changed_by TEXT NOT NULL, -- user ID who made the change
  category TEXT NOT NULL,
  old_value JSON,
  new_value JSON,
  change_reason TEXT,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);
```

## API Endpoints

The settings API is split into two separate modules for better organization:

- **User Settings API** (`/api/settings/user/*`) - Personal user settings
- **Organization Settings API** (`/api/settings/organization/*`) - Organization-wide settings

### User Settings

#### GET /api/settings/user

Get current user's settings.

**Headers:**

- `Authorization: Bearer <token>` (Better Auth JWT)
- `X-User-ID: <user-id>` (for development)

**Response:**

```json
{
  "data": {
    "preferences": {
      "theme": "system",
      "language": "en",
      "timezone": "UTC",
      "emailNotifications": true,
      "pushNotifications": true,
      "marketingEmails": false,
      "twoFactorEnabled": false,
      "defaultCurrency": "USD",
      "dateFormat": "MM/DD/YYYY",
      "timeFormat": "12h"
    },
    "profile": {
      "bio": "",
      "website": "",
      "location": "",
      "company": "",
      "jobTitle": "",
      "socialLinks": {
        "twitter": "",
        "linkedin": "",
        "github": ""
      }
    },
    "privacy": {
      "profileVisibility": "organization",
      "showEmail": false,
      "showLocation": false,
      "allowDirectMessages": true
    }
  }
}
```

#### PUT /api/settings/user

Update user settings.

**Request Body:**

```json
{
  "preferences": {
    "theme": "dark",
    "language": "es",
    "emailNotifications": false
  },
  "profile": {
    "bio": "Software Developer",
    "website": "https://example.com",
    "company": "Acme Corp"
  },
  "privacy": {
    "profileVisibility": "public",
    "showEmail": true
  }
}
```

#### PUT /api/settings/user/:category

Update specific category of user settings.

**Categories:** `preferences`, `profile`, `privacy`

**Example - Update preferences:**

```json
PUT /api/settings/user/preferences
{
  "theme": "dark",
  "language": "es",
  "timezone": "America/New_York"
}
```

### Organization Settings

#### GET /api/settings/organization/:organizationId

Get organization settings.

**Headers:**

- `Authorization: Bearer <token>` (Better Auth JWT)
- `X-Organization-ID: <org-id>` (for development)

**Response:**

```json
{
  "data": {
    "general": {
      "name": "Acme Corporation",
      "description": "Leading software company",
      "website": "https://acme.com",
      "timezone": "America/New_York",
      "defaultLanguage": "en",
      "currency": "USD"
    },
    "notifications": {
      "emailNotifications": true,
      "slackIntegration": true,
      "webhookUrl": "https://hooks.slack.com/...",
      "notificationChannels": ["email", "slack"]
    },
    "billing": {
      "stripeCustomerId": "cus_...",
      "subscriptionPlan": "pro",
      "billingEmail": "billing@acme.com",
      "taxId": "12-3456789",
      "billingAddress": {
        "line1": "123 Main St",
        "city": "New York",
        "state": "NY",
        "postalCode": "10001",
        "country": "US"
      }
    },
    "security": {
      "requireTwoFactor": true,
      "sessionTimeout": 480,
      "allowedDomains": ["acme.com"],
      "passwordPolicy": {
        "minLength": 12,
        "requireUppercase": true,
        "requireLowercase": true,
        "requireNumbers": true,
        "requireSymbols": true
      }
    },
    "integrations": {
      "stripe": {
        "connectedAccountId": "acct_...",
        "webhookSecret": "whsec_...",
        "testMode": false
      },
      "slack": {
        "workspaceId": "T1234567890",
        "botToken": "xoxb-...",
        "channelId": "C1234567890"
      }
    },
    "features": {
      "enabledFeatures": ["advanced-analytics", "custom-branding"],
      "featureFlags": {
        "beta-features": true,
        "experimental-ui": false
      },
      "limits": {
        "maxUsers": 100,
        "maxProjects": 50,
        "maxStorage": 10000
      }
    }
  }
}
```

#### PUT /api/settings/organization/:organizationId

Update organization settings.

**Permissions:** Requires `owner` or `admin` role in organization.

#### PUT /api/settings/organization/:organizationId/:category

Update specific category of organization settings.

**Categories:** `general`, `notifications`, `billing`, `security`, `integrations`, `features`

**Example - Update billing:**

```json
PUT /api/settings/organization/org_123/billing
{
  "subscriptionPlan": "enterprise",
  "billingEmail": "enterprise@acme.com",
  "billingAddress": {
    "line1": "456 Enterprise Ave",
    "city": "San Francisco",
    "state": "CA",
    "postalCode": "94105",
    "country": "US"
  }
}
```

### Settings History

#### GET /api/settings/history/:entityType/:entityId

Get settings change history.

**Parameters:**

- `entityType`: `user` or `organization`
- `entityId`: User ID or Organization ID
- `limit`: Query parameter (default: 50)

**Response:**

```json
{
  "data": [
    {
      "id": "hist_123",
      "entityType": "organization",
      "entityId": "org_123",
      "changedBy": "user_456",
      "category": "billing",
      "oldValue": { "subscriptionPlan": "pro" },
      "newValue": { "subscriptionPlan": "enterprise" },
      "changeReason": "Upgraded to enterprise plan",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Better Auth Integration

### Authentication

The settings API integrates with Better Auth for authentication:

1. **JWT Tokens**: Uses Better Auth JWT tokens for authentication
2. **Session Management**: Leverages Better Auth session handling
3. **Organization Context**: Uses Better Auth's active organization feature

### Authorization

Role-based access control:

- **User Settings**: Users can only access their own settings
- **Organization Settings**:
  - `member`: Read access only
  - `admin`: Read/write access to most settings
  - `owner`: Full access to all settings including billing and security

### Integration Points

```typescript
// Better Auth Integration Helper
import { BetterAuthIntegration } from './services/better-auth-integration';

// Get user ID from Better Auth session
const userId = BetterAuthIntegration.getUserId(request);

// Check organization access
const hasAccess = BetterAuthIntegration.canAccessOrganization(
  request,
  organizationId,
);

// Get user role in organization
const role = BetterAuthIntegration.getUserRoleInOrganization(
  request,
  organizationId,
);
```

## Usage Examples

### Frontend Integration

```typescript
// Get user settings
const response = await fetch('/api/settings/user', {
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});
const { data: settings } = await response.json();

// Update user preferences
await fetch('/api/settings/user/preferences', {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    theme: 'dark',
    language: 'es',
    timezone: 'America/New_York',
  }),
});

// Update organization billing
await fetch('/api/settings/organization/org_123/billing', {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    subscriptionPlan: 'enterprise',
    billingEmail: 'billing@company.com',
  }),
});
```

### Backend Integration

```typescript
import { SettingsService } from './services/settings-service';

const settingsService = new SettingsService();

// Get user settings
const userSettings = await settingsService.getUserSettings(userId);

// Update organization settings
await settingsService.updateOrganizationSettings(
  organizationId,
  {
    billing: {
      subscriptionPlan: 'enterprise',
      billingEmail: 'billing@company.com',
    },
  },
  userId, // changedBy
);

// Get settings history
const history = await settingsService.getSettingsHistory(
  'organization',
  organizationId,
);
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message"
}
```

Common error scenarios:

- **401 Unauthorized**: User not authenticated
- **403 Forbidden**: Insufficient permissions
- **400 Bad Request**: Invalid input data
- **404 Not Found**: Settings not found
- **500 Internal Server Error**: Server error

## Security Considerations

1. **Authentication**: All endpoints require valid Better Auth session
2. **Authorization**: Role-based access control for organization settings
3. **Input Validation**: All inputs validated with Zod schemas
4. **Audit Trail**: All changes recorded in settings history
5. **Data Encryption**: Sensitive data should be encrypted at rest
6. **Rate Limiting**: Implement rate limiting on settings endpoints

## Migration

To add the settings system to your database:

```bash
# Generate migration
npm run db:generate

# Apply migration
npm run db:migrate
```

The settings system will automatically register with Fastify's AutoLoad system and be available at `/api/settings/*` endpoints.
