# Blawby-TS Clean Architecture Refactor Plan

## Principles
- ✅ Use `type` (not `interface`)
- ✅ Functions only (no classes)
- ✅ Module-based with shared utilities
- ✅ Separation of concerns

---

## Target Structure

```
src/
├── shared/
│   ├── lib/
│   │   └── validate.ts              (validateBody, validateQuery, validateParams)
│   ├── types/
│   │   └── common.ts                (PaginationParams, ApiResponse, etc)
│   └── validations/
│       └── common.ts                (email, phone, url, uuid validators)
├── types/
│   └── database.ts                  (All DB types - auto-generated)
├── modules/
│   └── [module-name]/
│       ├── types/
│       │   └── [module].types.ts    (Module-specific types)
│       ├── validations/
│       │   └── [module].validation.ts (Zod schemas)
│       ├── database/
│       │   ├── schema/
│       │   │   └── [module].schema.ts (ONLY pgTable)
│       │   └── queries/
│       │       └── [module].repository.ts
│       ├── services/
│       ├── routes/
│       └── index.ts                 (Barrel exports)
```

---

## Phase 1: Create Shared Infrastructure (30 min)

### Create folders and files:
```bash
mkdir -p src/shared/{lib,types,validations}
touch src/shared/lib/validate.ts
touch src/shared/types/common.ts
touch src/shared/validations/common.ts
```

### Files to create:

**1. `src/shared/lib/validate.ts`**
- `validateBody<T>(request, schema)`
- `validateQuery<T>(request, schema)`
- `validateParams<T>(request, schema)`

**2. `src/shared/types/common.ts`**
- Common types: `PaginationParams`, `PaginatedResponse<T>`, `ApiResponse<T>`, `ApiError`
- Use `type` not `interface`

**3. `src/shared/validations/common.ts`**
- Reusable validators: `emailValidator`, `phoneValidator`, `urlValidator`, `uuidValidator`, `currencyValidator`
- Common schemas: `paginationSchema`, `searchSchema`, `idParamSchema`

---

## Phase 2: Create Central DB Types (30 min)

**Create:** `src/types/database.ts`

**For each table in your schema:**
- Export type (e.g., `type Practice = typeof schema.practiceDetails.$inferSelect`)
- Export insert type (e.g., `type InsertPractice = typeof schema.practiceDetails.$inferInsert`)
- Export base zod schemas (e.g., `basePracticeInsertSchema`, `basePracticeSelectSchema`)

**Tables to include:**
- practiceDetails
- clients
- invoices
- paymentIntents
- paymentLinks
- subscriptions
- stripeCustomers
- payouts
- webhookEvents
- stripeConnectedAccounts
- subscriptionPlans
- subscriptionLineItems
- subscriptionEvents
- (all other tables...)

---

## Phase 3: Refactor All Modules (4-5 hours)

### For EACH module, do steps 3.1 - 3.8:

**Modules list:**
1. practice
2. clients
3. invoices
4. payments (payment-intents + payment-links)
5. payouts
6. subscriptions
7. customers (stripe)
8. stripe (webhooks, connected accounts)
9. onboarding
10. settings

---

### 3.1 Create Module Folders
```bash
mkdir -p src/modules/[module]/{types,validations}
```

### 3.2 Create Module Types File
**`src/modules/[module]/types/[module].types.ts`**

- Import base types from `@/types/database` (use alias)
- **Do NOT re-export** base types - consumers should import from source
- Add ONLY module-specific types (relationships, computed types, etc.)
- Use `type` only

**Example:**
```typescript
// ❌ BAD - Don't re-export
export type { Practice, InsertPractice } from '@/types/database'

// ✅ GOOD - Only module-specific types
import type { Practice } from '@/types/database'

export type PracticeWithOwner = Practice & {
  owner: {
    id: string
    name: string
  }
}

export type PracticeStats = {
  totalClients: number
  totalRevenue: number
}
```

### 3.3 Create Module Validation File
**`src/modules/[module]/validations/[module].validation.ts`**

- Import shared validators from `@/shared/validations/common` (use alias)
- Create API validation schemas: `createXSchema`, `updateXSchema`, `queryXSchema`
- Extract ALL custom zod validation from schema files and move here

### 3.4 Clean Schema File
**`src/modules/[module]/database/schema/[module].schema.ts`**

**Remove:**
- All `createInsertSchema()` calls
- All custom zod validators
- All `export type` statements
- All `.omit()`, `.pick()`, `.extend()`

**Keep ONLY:**
- `pgTable()` definitions
- `pgEnum()` definitions
- Column definitions with types

### 3.5 Update Repository/Queries
**`src/modules/[module]/database/queries/[module].repository.ts`**

- Import types from `@/types/database` (use alias, not from module types)
- Import schema from `@/modules/[module]/database/schema/[module].schema` (use alias)
- Import db from `@/database` (use alias)
- Pure functions only (no classes)

### 3.6 Update Routes
**`src/modules/[module]/routes/*.ts`**

- Import validation utility: `@/shared/lib/validate` (use alias)
- Import validation schemas: `@/modules/[module]/validations/[module].validation` (use alias)
- Import repository functions: `@/modules/[module]/database/queries/[module].repository` (use alias)
- **Don't re-import through barrel** - import directly from source files

**Pattern:**
```typescript
import { validateBody } from '@/shared/lib/validate'
import { createPracticeSchema } from '@/modules/practice/validations/practice.validation'
import { createPractice } from '@/modules/practice/database/queries/practice.repository'

export default async function(request, reply) {
  const body = await validateBody(request, createPracticeSchema)
  const practice = await createPractice(body)
  return practice
}
```

### 3.7 Update Services (if any)
**`src/modules/[module]/services/[module].service.ts`**

- Import types from `@/types/database` (use alias, not re-exports)
- Import repository from `@/modules/[module]/database/queries/[module].repository` (use alias)
- Pure functions only

### 3.8 Create Barrel Export
**`src/modules/[module]/index.ts`**

```typescript
// For external imports from other modules only
export * from './types/[module].types'
export * from './validations/[module].validation'
export * from './database/queries/[module].repository'
// Don't export schema (rarely needed outside module)
```

**Note:** Barrel exports are ONLY for importing from other modules. Within the same module, import directly from source files.

---

## Phase 4: Update Existing Imports (1 hour)

**Find and replace across all files:**

### Import Rules

1. **Always use `@/` path alias** (never `../` relative paths)
2. **Import directly from source files** within same module (avoid barrel re-imports)
3. **Use barrel exports** only when importing from other modules
4. **No re-exports** - always import from original source

### Examples

**Importing types:**
```typescript
// ❌ BAD - Don't import re-exported types
import type { Practice } from '@/modules/practice/types/practice.types'
import type { Practice } from '@/modules/practice'

// ✅ GOOD - Import from original source
import type { Practice } from '@/types/database'
```

**Importing validations (within same module):**
```typescript
// ❌ BAD - relative paths or barrel
import { createPracticeSchema } from '../validations/practice.validation'
import { createPracticeSchema } from '@/modules/practice'

// ✅ GOOD - direct import with alias
import { createPracticeSchema } from '@/modules/practice/validations/practice.validation'
```

**Importing from other modules:**
```typescript
// ✅ GOOD - use barrel export from other module
import { createClient } from '@/modules/clients'

// OR import directly if barrel doesn't have it
import { createClient } from '@/modules/clients/database/queries/clients.repository'
```

**Importing shared utilities:**
```typescript
// ✅ GOOD - always use alias
import { validateBody } from '@/shared/lib/validate'
import { emailValidator } from '@/shared/validations/common'
import type { PaginationParams } from '@/shared/types/common'
```

### Old pattern → New pattern

**Types:**
```typescript
// OLD
import { InsertPracticeDetails } from '@/modules/practice/database/schema/practice.schema'

// NEW
import type { InsertPractice } from '@/types/database'
```

**Validations:**
```typescript
// OLD
import { insertPracticeDetailsSchema } from '@/modules/practice/database/schema/practice.schema'

// NEW
import { createPracticeSchema } from '@/modules/practice/validations/practice.validation'
```

**Validation usage:**
```typescript
// OLD
const validated = insertPracticeSchema.parse(request.body)

// NEW
const body = await validateBody(request, createPracticeSchema)
```

---

## Phase 5: Clean Up (30 min)

1. Remove unused exports from schema files
2. Remove unused validation code
3. Run: `pnpm run typecheck`
4. Fix any remaining type errors
5. Test API endpoints

---

## File Structure Summary

### Shared (Common across all modules)
```
src/shared/
├── lib/validate.ts          ← validateBody, validateQuery, validateParams
├── types/common.ts          ← Common types (use `type`)
└── validations/common.ts    ← Reusable validators
```

### Central Types
```
src/types/database.ts        ← All DB types (auto-generated from schemas)
```

### Per Module
```
src/modules/[module]/
├── types/
│   └── [module].types.ts        ← Module-specific types ONLY (no re-exports)
├── validations/
│   └── [module].validation.ts   ← Zod API schemas
├── database/
│   ├── schema/
│   │   └── [module].schema.ts   ← ONLY pgTable (clean)
│   └── queries/
│       └── [module].repository.ts ← Pure functions
├── services/
│   └── [module].service.ts      ← Pure functions
├── routes/
│   └── *.ts
└── index.ts                     ← Barrel exports
```

---

## Checklist Per Module

- [ ] Create `types/[module].types.ts`
- [ ] Create `validations/[module].validation.ts`
- [ ] Clean `schema/[module].schema.ts` (remove validation)
- [ ] Update `queries/[module].repository.ts` imports
- [ ] Update all `routes/*.ts` to use validateBody
- [ ] Update `services/[module].service.ts` imports
- [ ] Create `index.ts` barrel export
- [ ] Test module endpoints

**Repeat for all 10 modules.**

---

## Quick Command

```bash
# Generate structure for all modules at once
for module in practice clients invoices payments payouts subscriptions customers stripe onboarding settings; do
  mkdir -p src/modules/$module/{types,validations}
  touch src/modules/$module/types/${module}.types.ts
  touch src/modules/$module/validations/${module}.validation.ts
  touch src/modules/$module/index.ts
done
```

---

## Rules to Follow

✅ **Use `type` everywhere** (no `interface`)
✅ **Pure functions only** (no classes)
✅ **Separate concerns** (schema ≠ validation ≠ types)
✅ **Import from shared** when reusable
✅ **Keep in module** when module-specific
✅ **Clean schema files** (ONLY table definitions)
✅ **Barrel exports** (`index.ts` in each module for external use only)
✅ **Use path aliases** (always `@/` - never relative paths like `../`)
✅ **Avoid re-imports** (import directly from source, not through barrel when in same module)
✅ **No re-exports** (don't import and re-export from central types - keep types at source)

---

## Estimated Time

- Phase 1: 30 min (shared setup)
- Phase 2: 30 min (central types)
- Phase 3: 4-5 hours (all modules)
- Phase 4: 1 hour (update imports)
- Phase 5: 30 min (cleanup)

**Total: 6-7 hours**

**Approach:** Do practice module first completely, then use as template for others.
