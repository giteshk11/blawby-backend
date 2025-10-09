# Architecture Migration: File-Based Routing + Vertical Slices + Feature-Level Auth

## Current Implementation Status ✅

**Migration Status**: **COMPLETED** - All modules successfully migrated to new architecture

## Current Structure (Implemented)

```
src/
├── app.ts                     # Main Fastify application entry point
├── server.ts                  # Server configuration and startup
├── database/                  # Database connection and migrations
│   ├── index.ts              # Database client setup
│   └── migrations/           # Drizzle migration files
├── shared/                    # Shared utilities and middleware
│   ├── auth/                 # Authentication system
│   │   ├── better-auth.ts    # Better Auth configuration
│   │   └── verify-auth.ts    # Auth verification middleware
│   ├── database/             # Database utilities
│   ├── middleware/            # Fastify middleware plugins
│   │   ├── cors.ts           # CORS configuration
│   │   ├── helmet.ts         # Security headers
│   │   ├── rate-limit.ts     # Rate limiting
│   │   └── sensible.ts       # Error handling
│   ├── router/               # File-based routing system
│   │   └── file-router.ts    # Auto-discovery route registration
│   ├── types/                # Global TypeScript definitions
│   │   ├── fastify.d.ts      # Fastify type extensions
│   │   └── route-config.ts   # Route configuration types
│   └── utils/                # Utility functions
├── schema/                    # Drizzle schema definitions
│   ├── index.ts              # Schema exports
│   └── better-auth-schema.ts # Better Auth schemas
├── types/                     # Global TypeScript type definitions
└── modules/                   # Feature-based modules
    ├── billing/              # Payment and billing features
    │   ├── routes.config.ts  # Route configuration
    │   ├── routes/           # API route handlers
    │   │   ├── onboarding.post.ts
    │   │   └── organization/
    │   │       └── [organizationId]/
    │   │           ├── onboarding-status.get.ts
    │   │           ├── payments-session.post.ts
    │   │           └── login-link.post.ts
    │   ├── services/         # Business logic services
    │   │   └── billing.service.ts
    │   ├── repositories/     # Data access layer
    │   │   └── billing.repository.ts
    │   └── schemas/          # Database schemas and validation
    │       └── billing.schema.ts
    ├── practice/             # Practice/organization management
    │   ├── routes.config.ts  # Route configuration
    │   ├── routes/           # API route handlers
    │   │   ├── list.get.ts   # GET /api/practice/list
    │   │   ├── index.post.ts # POST /api/practice/
    │   │   ├── [id].get.ts   # GET /api/practice/:id
    │   │   ├── [id].put.ts   # PUT /api/practice/:id
    │   │   ├── [id].delete.ts # DELETE /api/practice/:id
    │   │   └── [id]/
    │   │       └── active.put.ts
    │   ├── services/         # Business logic services
    │   │   ├── practice.service.ts
    │   │   └── organization.service.ts
    │   ├── repositories/     # Data access layer
    │   │   └── practice-details.repository.ts
    │   └── schemas/          # Database schemas and validation
    │       └── practice.schema.ts
    ├── settings/             # User and org settings
    │   ├── routes.config.ts  # Route configuration
    │   ├── routes/           # API route handlers
    │   │   ├── user.get.ts
    │   │   ├── user.put.ts
    │   │   ├── user/
    │   │   │   ├── [category].put.ts
    │   │   │   └── history.get.ts
    │   │   └── organization/
    │   │       └── [organizationId]/
    │   │           ├── [organizationId].get.ts
    │   │           ├── [organizationId].put.ts
    │   │           └── [category].put.ts
    │   ├── services/         # Business logic services
    │   │   └── settings.service.ts
    │   ├── repositories/     # Data access layer
    │   │   └── settings.repository.ts
    │   └── schemas/          # Database schemas and validation
    │       └── settings.schema.ts
    └── health/               # Health check endpoints
        ├── routes.config.ts  # Route configuration
        └── routes/           # API route handlers
            └── index.get.ts  # GET /api/health/
```

---

## Key Implementation Details ✅

### 1. Route Configuration System

**FILE**: `src/shared/types/route-config.ts` ✅ **IMPLEMENTED**

```typescript
export interface RouteConfig {
  // Default: all routes protected (true) or public (false)
  protected?: boolean;
  
  // List of public routes (if default is protected)
  public?: string[];
  
  // List of protected routes (if default is public)
  private?: string[];
  
  // Optional: Custom middleware per route
  middleware?: {
    [routePattern: string]: string[];
  };
  
  // Optional: Role-based access control
  roles?: {
    [routePattern: string]: string[];
  };
}
```

### 2. File-Based Router Implementation ✅

**FILE**: `src/shared/router/file-router.ts` ✅ **IMPLEMENTED**

**Key Features Implemented**:

- ✅ Auto-discovery of route files in `src/modules/*/routes/`
- ✅ HTTP method extraction from filename (`list.get.ts` → `GET`)
- ✅ URL path generation from file structure
- ✅ Route configuration loading from `routes.config.ts`
- ✅ Authentication middleware application based on config
- ✅ Default security (protected: true) when no config exists
- ✅ Pattern matching for dynamic routes (`[id].get.ts` → `/:id`)

**Route Discovery Process**:

1. **Scan**: `src/modules/*/routes/` directories
2. **Parse**: Filename to determine HTTP method and path
3. **Configure**: Apply route configuration from `routes.config.ts`
4. **Register**: With Fastify and proper middleware
5. **Authenticate**: Apply auth based on configuration

### 3. Authentication System ✅

**FILE**: `src/shared/auth/verify-auth.ts` ✅ **IMPLEMENTED**

**Key Features Implemented**:

- ✅ Better Auth integration with session validation
- ✅ Organization validation and cleanup
- ✅ Fallback session validation for edge cases
- ✅ Request decoration with user/session data
- ✅ Error handling for invalid organizations

**Authentication Flow**:

1. **Token Extraction**: Bearer token from Authorization header
2. **Session Validation**: Call Better Auth getSession API
3. **Organization Check**: Validate active organization access
4. **Fallback Handling**: Direct database query if Better Auth fails
5. **Request Decoration**: Attach user/session to request object

### 4. Database Integration ✅

**FILE**: `src/database/index.ts` ✅ **IMPLEMENTED**

**Key Features Implemented**:

- ✅ PostgreSQL connection with connection pooling
- ✅ Drizzle ORM integration
- ✅ Migration system with Drizzle Kit
- ✅ Schema exports for Better Auth
- ✅ SSL configuration for production

### 5. Module Implementation Status ✅

**All Modules Successfully Migrated**:

#### Practice Module ✅ **COMPLETED**

- ✅ **Routes**: `list.get.ts`, `index.post.ts`, `[id].get.ts`, `[id].put.ts`, `[id].delete.ts`
- ✅ **Services**: `practice.service.ts`, `organization.service.ts`
- ✅ **Repository**: `practice-details.repository.ts`
- ✅ **Schema**: `practice.schema.ts`
- ✅ **Config**: Route configuration with mixed auth

#### Billing Module ✅ **COMPLETED**

- ✅ **Routes**: Onboarding, payment sessions, login links, status checks
- ✅ **Services**: `billing.service.ts` with Stripe integration
- ✅ **Repository**: `billing.repository.ts`
- ✅ **Schema**: `billing.schema.ts` with Stripe tables
- ✅ **Config**: Mixed auth with public webhooks

#### Settings Module ✅ **COMPLETED**

- ✅ **Routes**: User and organization settings management
- ✅ **Services**: `settings.service.ts`
- ✅ **Repository**: `settings.repository.ts`
- ✅ **Schema**: `settings.schema.ts`
- ✅ **Config**: Fully protected routes

#### Health Module ✅ **COMPLETED**

- ✅ **Routes**: `index.get.ts` for health checks
- ✅ **Config**: Fully public routes

## Implementation Achievements ✅

### Key Architectural Improvements

1. **File-Based Routing System** ✅

   - Auto-discovery of route files
   - Intuitive URL mapping from file structure
   - Feature-level authentication configuration
   - Zero configuration for simple cases

2. **Better Auth Integration** ✅

   - JWT and Bearer token support
   - Organization management with validation
   - Session management with database hooks
   - Fallback authentication for edge cases

3. **Database Architecture** ✅

   - PostgreSQL with Drizzle ORM
   - Migration system with Drizzle Kit
   - Schema exports for Better Auth
   - Connection pooling and SSL support

4. **Modular Structure** ✅

   - Feature-based modules with clear separation
   - Service layer for business logic
   - Repository layer for data access
   - Schema definitions with validation

5. **Security Implementation** ✅
   - Default secure (protected: true)
   - Explicit public route configuration
   - Organization validation and cleanup
   - Rate limiting and security headers

## Route Configuration Patterns ✅

### Implemented Route Configurations

#### Practice Module (`src/modules/practice/routes.config.ts`)

```typescript
export const routeConfig: RouteConfig = {
  // Default: all routes require authentication
  protected: true,
  
  // Make specific routes public
  public: [
    'GET /[id]', // Anyone can view a practice
    'GET /list', // Public practice listing
  ],
  
  // Optional: Role-based access
  roles: {
    'DELETE /[id]': ['admin', 'owner'],
    'POST /organization': ['owner'],
  },
};
```

#### Billing Module (`src/modules/billing/routes.config.ts`)

```typescript
export const routeConfig: RouteConfig = {
  protected: true,
  
  // Webhooks are public (they verify via signature)
  public: ['POST /webhooks/stripe'],
  
  // Admin-only routes
  roles: {
    'GET /accounts': ['admin'],
    'DELETE /accounts/[id]': ['admin'],
  },
};
```

#### Health Module (`src/modules/health/routes.config.ts`)

```typescript
export const routeConfig: RouteConfig = {
  // All health routes are public
  protected: false,
};
```

#### Settings Module (`src/modules/settings/routes.config.ts`)

```typescript
export const routeConfig: RouteConfig = {
  // All settings routes require authentication
  protected: true,
};
```

## Current Implementation Status ✅

### Application Bootstrap (`src/app.ts`) ✅ **IMPLEMENTED**

```typescript
export default async function app(fastify: FastifyInstance) {
  // 1. Infrastructure plugins (order matters!)
  await fastify.register(sensiblePlugin); // Error handling
  await fastify.register(corsPlugin); // CORS
  await fastify.register(helmetPlugin); // Security headers
  await fastify.register(rateLimitPlugin); // Rate limiting

  // 2. Core services
  await fastify.register(dbPlugin); // Database connection
  await fastify.register(betterAuthPlugin); // Authentication
  await fastify.register(authCore); // Auth verification

  // 3. File-based routes (auto-discovery)
  await fastify.register(fileRouterPlugin);

  fastify.log.info('✅ Application setup complete');
}
```

## Success Criteria ✅ **ALL ACHIEVED**

- ✅ Server starts without errors
- ✅ All existing endpoints work at same URLs
- ✅ File path matches URL path intuitively
- ✅ Adding new route = just create file
- ✅ Auth configured per feature in routes.config.ts
- ✅ Default is secure (protected: true)
- ✅ Public routes explicitly listed
- ✅ Optional middleware support works
- ✅ Optional role-based access works
- ✅ No config needed for simple cases
- ✅ Stack traces show exact file
- ✅ Hot reload works per-file

## Route Examples ✅ **IMPLEMENTED**

### Protected Route Example

**File**: `src/modules/practice/routes/index.post.ts`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { createPractice } from '../services/practice.service';

export default async function createPracticeRoute(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const practice = await createPractice(
    request.body,
    request.user,
    request.server,
  );
  return reply.status(201).send({ practice });
}
```

### Public Route Example

**File**: `src/modules/practice/routes/list.get.ts`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { listPractices } from '../services/practice.service';

export default async function listPracticesRoute(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const practices = await listPractices(
    request.user,
    request.server,
    request.headers as Record<string, string>,
  );
  return reply.send({ practices });
}
```

### Webhook Route Example

**File**: `src/modules/billing/routes/webhooks/stripe.post.ts`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { handleStripeWebhook } from '../../services/billing.service';

export default async function stripeWebhookRoute(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const signature = request.headers['stripe-signature'] as string;
  await handleStripeWebhook(request.body, signature, request.server);
  return { received: true };
}
```
