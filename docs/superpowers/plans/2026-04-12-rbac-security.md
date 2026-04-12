# RBAC & Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement attribute-based access control (ABAC) with policy engine, security hardening (rate limiting, JWT validation, collegeId fix), and frontend permission enforcement across the entire Juvion v2 ERP.

**Architecture:** A `Policy` model stores allow/deny rules keyed by role, personaType, module, and action. The `authorize()` middleware evaluates policies from Redis cache (5-min TTL), attaches scope constraints (`departmentOnly`, `selfOnly`, `subDomain`) to the request, and services apply those constraints to queries. A `RBAC_ENFORCE` feature flag allows gradual rollout.

**Tech Stack:** Express middleware, Mongoose (Policy model), ioredis (cache), express-rate-limit, Vitest (new test framework), Zod (validation), React hooks (frontend permissions)

**Spec:** `docs/superpowers/specs/2026-04-12-rbac-security-design.md`

---

## File Map

### New Files — Backend
| File | Responsibility |
|------|---------------|
| `backend/src/models/platform/Policy.ts` | Policy Mongoose model |
| `backend/src/shared/rbac/types.ts` | AuthScope, PolicyDoc, RbacOptions interfaces |
| `backend/src/shared/rbac/defaults.ts` | Default policy constants (~80 rules) |
| `backend/src/shared/rbac/engine.ts` | Policy evaluation: load, filter, match, resolve scope |
| `backend/src/shared/rbac/cache.ts` | Redis get/set/invalidate for policy cache |
| `backend/vitest.config.ts` | Vitest configuration |
| `backend/src/shared/rbac/__tests__/engine.test.ts` | Policy engine unit tests |
| `backend/src/shared/rbac/__tests__/cache.test.ts` | Cache helper tests |
| `backend/src/middleware/__tests__/authorize.test.ts` | Authorize middleware tests |

### New Files — Frontend
| File | Responsibility |
|------|---------------|
| `admin-portal/src/hooks/usePermission.ts` | Permission check hook |
| `admin-portal/src/pages/platform/Policies.tsx` | Policy management page |
| `admin-portal/src/services/policies.ts` | Policy CRUD API service |

### Modified Files
| File | Change |
|------|--------|
| `backend/package.json` | Add vitest, express-rate-limit deps |
| `backend/src/shared/types.ts` | Add AuthScope interface |
| `backend/src/middleware/authorize.ts` | Rewrite with policy engine |
| `backend/src/middleware/authenticate.ts` | CollegeId header fix, AuthScope on request |
| `backend/src/app.ts` | Rate limiting, JWT validation, health endpoint |
| `backend/src/modules/auth/service.ts` | Return resolvedPermissions, add refresh |
| `backend/src/modules/auth/routes.ts` | Add refresh + health endpoints |
| `backend/src/modules/auth/controller.ts` | Add refresh + health controllers |
| `backend/src/seed.ts` | Seed default policies |
| `backend/src/modules/*/routes.ts` | Add authorize() to all 13 module routers |
| `admin-portal/src/stores/authStore.ts` | Add permissions + hasPermission |
| `admin-portal/src/layouts/DashboardLayout.tsx` | Filter sidebar by permissions |
| `admin-portal/src/services/platform.ts` | Add policy CRUD functions |

---

### Task 1: Set Up Test Infrastructure

**Files:**
- Create: `backend/vitest.config.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Install vitest and test dependencies**

```bash
cd backend && npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: Create vitest config**

Create `backend/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/shared/rbac/**', 'src/middleware/**'],
    },
  },
});
```

- [ ] **Step 3: Add test scripts to backend package.json**

Add to `backend/package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 4: Verify vitest runs (no tests yet — should show 0 tests)**

```bash
cd backend && npm test
```

Expected: `No test files found` or `0 tests passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/vitest.config.ts backend/package.json backend/package-lock.json
git commit -m "chore: add vitest test framework to backend"
```

---

### Task 2: RBAC Types and Interfaces

**Files:**
- Create: `backend/src/shared/rbac/types.ts`
- Modify: `backend/src/shared/types.ts`

- [ ] **Step 1: Create RBAC types file**

Create `backend/src/shared/rbac/types.ts`:

```typescript
export interface PolicyDoc {
  _id?: string;
  collegeId?: string;          // null = system default
  role: string;                // 'super_admin' | 'admin' | ... | '*'
  personaType?: string | null; // 'ST-WARDEN' | 'F-HOD-*' | null
  module: string;              // 'finance' | '*'
  action: string;              // 'read' | 'create' | 'update' | 'delete' | 'approve' | '*'
  effect: 'allow' | 'deny';
  scope?: PolicyScope;
  priority: number;
  description?: string;
  isActive: boolean;
}

export interface PolicyScope {
  departmentOnly?: boolean;
  selfOnly?: boolean;
  subDomain?: string;          // comma-separated: 'hostel,mess'
}

export interface AuthScope {
  departmentOnly: boolean;
  departmentId?: string;
  selfOnly: boolean;
  userId: string;
  personId?: string;
  subDomain?: string[];
  resolvedPermissions: string[];
}

export interface RbacOptions {
  subDomain?: string;
}
```

- [ ] **Step 2: Add AuthScope to shared types**

In `backend/src/shared/types.ts`, add to the `AuthRequest` interface:

```typescript
import { AuthScope } from './rbac/types';

export interface AuthRequest extends Request {
  collegeId?: string;
  user?: { id: string; name: string; email: string; role: string; personaType: string };
  authScope?: AuthScope;
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd backend && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/shared/rbac/types.ts backend/src/shared/types.ts
git commit -m "feat(rbac): add RBAC type definitions and AuthScope interface"
```

---

### Task 3: Policy Mongoose Model

**Files:**
- Create: `backend/src/models/platform/Policy.ts`

- [ ] **Step 1: Create Policy model**

Create `backend/src/models/platform/Policy.ts`:

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IPolicy extends Document {
  collegeId?: mongoose.Types.ObjectId;
  role: string;
  personaType?: string;
  module: string;
  action: string;
  effect: 'allow' | 'deny';
  scope?: {
    departmentOnly?: boolean;
    selfOnly?: boolean;
    subDomain?: string;
  };
  priority: number;
  description?: string;
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
}

const policySchema = new Schema<IPolicy>(
  {
    collegeId: { type: Schema.Types.ObjectId, index: true },
    role: { type: String, required: true },
    personaType: { type: String, default: null },
    module: { type: String, required: true },
    action: { type: String, required: true },
    effect: { type: String, required: true, enum: ['allow', 'deny'] },
    scope: {
      departmentOnly: { type: Boolean },
      selfOnly: { type: Boolean },
      subDomain: { type: String },
    },
    priority: { type: Number, required: true, default: 500 },
    description: { type: String },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  { timestamps: true },
);

policySchema.index({ collegeId: 1, role: 1, module: 1, isActive: 1 });
policySchema.index({ collegeId: 1, isActive: 1 });

export const Policy = mongoose.model<IPolicy>('Policy', policySchema);
```

- [ ] **Step 2: Run typecheck**

```bash
cd backend && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/models/platform/Policy.ts
git commit -m "feat(rbac): add Policy mongoose model"
```

---

### Task 4: Default Policy Constants

**Files:**
- Create: `backend/src/shared/rbac/defaults.ts`

- [ ] **Step 1: Create default policies constant**

Create `backend/src/shared/rbac/defaults.ts`:

```typescript
import { PolicyDoc } from './types';

/**
 * System default policies seeded into the database.
 * College admins can override these with college-specific policies.
 * Higher priority = evaluated first. College-specific > defaults.
 */
export const DEFAULT_POLICIES: Omit<PolicyDoc, '_id'>[] = [
  // ── super_admin: full access ──
  { role: 'super_admin', module: '*', action: '*', effect: 'allow', priority: 1000, isActive: true, description: 'Super admin: unrestricted access' },

  // ── admin: full access within their college ──
  { role: 'admin', module: '*', action: '*', effect: 'allow', priority: 950, isActive: true, description: 'College admin: full college access' },

  // ── principal: read everything + governance/compliance/platform write ──
  { role: 'principal', module: '*', action: 'read', effect: 'allow', priority: 900, isActive: true, description: 'Principal: read all modules' },
  { role: 'principal', module: 'governance', action: '*', effect: 'allow', priority: 900, isActive: true, description: 'Principal: full governance access' },
  { role: 'principal', module: 'compliance', action: '*', effect: 'allow', priority: 900, isActive: true, description: 'Principal: full compliance access' },
  { role: 'principal', module: 'platform', action: '*', effect: 'allow', priority: 900, isActive: true, description: 'Principal: full platform access' },
  { role: 'principal', module: 'finance', action: 'approve', effect: 'allow', priority: 900, isActive: true, description: 'Principal: approve finance actions' },

  // ── hod: department-scoped academics + read people/hr/student-dev ──
  { role: 'hod', module: 'academics', action: '*', effect: 'allow', priority: 800, isActive: true, scope: { departmentOnly: true }, description: 'HOD: full academics in own department' },
  { role: 'hod', module: 'people', action: 'read', effect: 'allow', priority: 800, isActive: true, scope: { departmentOnly: true }, description: 'HOD: read people in own department' },
  { role: 'hod', module: 'hr', action: 'read', effect: 'allow', priority: 800, isActive: true, scope: { departmentOnly: true }, description: 'HOD: read HR in own department' },
  { role: 'hod', module: 'student-dev', action: 'read', effect: 'allow', priority: 800, isActive: true, scope: { departmentOnly: true }, description: 'HOD: read student dev in own department' },
  { role: 'hod', module: 'placement', action: 'read', effect: 'allow', priority: 800, isActive: true, description: 'HOD: read placement data' },

  // ── faculty: attendance, marks, lesson plans + read academics/people ──
  { role: 'faculty', module: 'academics', action: 'read', effect: 'allow', priority: 700, isActive: true, description: 'Faculty: read academics' },
  { role: 'faculty', module: 'academics', action: 'create', effect: 'allow', priority: 700, isActive: true, scope: { subDomain: 'attendance,marks,lesson-plans,feedback' }, description: 'Faculty: create attendance/marks/lesson-plans' },
  { role: 'faculty', module: 'academics', action: 'update', effect: 'allow', priority: 700, isActive: true, scope: { subDomain: 'attendance,marks,lesson-plans,feedback' }, description: 'Faculty: update attendance/marks/lesson-plans' },
  { role: 'faculty', module: 'people', action: 'read', effect: 'allow', priority: 700, isActive: true, scope: { departmentOnly: true }, description: 'Faculty: read people in own department' },
  { role: 'faculty', module: 'student-dev', action: 'read', effect: 'allow', priority: 700, isActive: true, description: 'Faculty: read student dev' },

  // ── staff with personaType scoping ──
  { role: 'staff', personaType: 'ST-ADM', module: 'admissions', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'Admissions staff: full admissions access' },
  { role: 'staff', personaType: 'ST-ADM', module: 'people', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'Admissions staff: full people access' },
  { role: 'staff', personaType: 'ST-ACC', module: 'finance', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'Accounts staff: full finance access' },
  { role: 'staff', personaType: 'ST-HR', module: 'hr', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'HR staff: full HR access' },
  { role: 'staff', personaType: 'ST-HR', module: 'people', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'HR staff: full people access' },
  { role: 'staff', personaType: 'ST-WARDEN', module: 'welfare', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'hostel,mess' }, description: 'Warden: hostel and mess welfare' },
  { role: 'staff', personaType: 'ST-TPO', module: 'placement', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'TPO: full placement access' },
  { role: 'staff', personaType: 'ST-EXAM', module: 'academics', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'exams,results' }, description: 'Exam controller: exams and results' },
  { role: 'staff', personaType: 'ST-LIB', module: 'campus', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'library' }, description: 'Librarian: library sub-domain' },
  { role: 'staff', personaType: 'ST-SEC', module: 'campus', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'security,gate-pass,visitors' }, description: 'Security: security sub-domain' },
  { role: 'staff', personaType: 'ST-IQAC', module: 'compliance', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'IQAC coordinator: full compliance' },
  { role: 'staff', personaType: 'ST-REG', module: 'people', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'Registrar: full people access' },
  { role: 'staff', personaType: 'ST-REG', module: 'academics', action: 'read', effect: 'allow', priority: 750, isActive: true, description: 'Registrar: read academics' },
  // Base staff fallback: read-only
  { role: 'staff', module: '*', action: 'read', effect: 'allow', priority: 600, isActive: true, description: 'Staff base: read-only fallback' },

  // ── student: self-scoped read + limited create ──
  { role: 'student', module: 'academics', action: 'read', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true }, description: 'Student: read own academics' },
  { role: 'student', module: 'finance', action: 'read', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true }, description: 'Student: read own finance' },
  { role: 'student', module: 'welfare', action: 'read', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true }, description: 'Student: read own welfare' },
  { role: 'student', module: 'welfare', action: 'create', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true, subDomain: 'grievance' }, description: 'Student: file grievances' },
  { role: 'student', module: 'placement', action: 'read', effect: 'allow', priority: 600, isActive: true, description: 'Student: read placement listings' },
  { role: 'student', module: 'placement', action: 'create', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true, subDomain: 'registration' }, description: 'Student: register for placements' },
  { role: 'student', module: 'student-dev', action: 'read', effect: 'allow', priority: 600, isActive: true, description: 'Student: read student dev' },
  { role: 'student', module: 'student-dev', action: 'create', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true, subDomain: 'registration,membership' }, description: 'Student: join clubs/events' },
  { role: 'student', module: 'people', action: 'read', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true }, description: 'Student: read own profile' },

  // ── parent: read children's records ──
  { role: 'parent', module: 'academics', action: 'read', effect: 'allow', priority: 500, isActive: true, scope: { selfOnly: true }, description: 'Parent: read linked children academics' },
  { role: 'parent', module: 'finance', action: 'read', effect: 'allow', priority: 500, isActive: true, scope: { selfOnly: true }, description: 'Parent: read linked children finance' },
  { role: 'parent', module: 'welfare', action: 'read', effect: 'allow', priority: 500, isActive: true, scope: { selfOnly: true }, description: 'Parent: read linked children welfare' },
  { role: 'parent', module: 'people', action: 'read', effect: 'allow', priority: 500, isActive: true, scope: { selfOnly: true }, description: 'Parent: read own + children profiles' },
];
```

- [ ] **Step 2: Run typecheck**

```bash
cd backend && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/shared/rbac/defaults.ts
git commit -m "feat(rbac): add default policy constants for all roles"
```

---

### Task 5: Redis Cache Helpers

**Files:**
- Create: `backend/src/shared/rbac/cache.ts`
- Create: `backend/src/shared/rbac/__tests__/cache.test.ts`

- [ ] **Step 1: Write cache helper tests**

Create `backend/src/shared/rbac/__tests__/cache.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCachedPolicies, setCachedPolicies, invalidatePolicies } from '../cache';

// Mock redis
vi.mock('../../../config/redis', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
  },
}));

import redis from '../../../config/redis';

describe('RBAC Cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getCachedPolicies returns null on cache miss', async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await getCachedPolicies('college1', 'faculty');
    expect(result).toBeNull();
    expect(redis.get).toHaveBeenCalledWith('rbac:college1:faculty');
  });

  it('getCachedPolicies returns parsed policies on cache hit', async () => {
    const policies = [{ role: 'faculty', module: 'academics', action: 'read', effect: 'allow', priority: 700, isActive: true }];
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(policies));
    const result = await getCachedPolicies('college1', 'faculty');
    expect(result).toEqual(policies);
  });

  it('setCachedPolicies stores JSON with TTL', async () => {
    const policies = [{ role: 'faculty', module: 'academics', action: 'read', effect: 'allow', priority: 700, isActive: true }];
    await setCachedPolicies('college1', 'faculty', policies as any);
    expect(redis.set).toHaveBeenCalledWith('rbac:college1:faculty', JSON.stringify(policies), 'EX', 300);
  });

  it('invalidatePolicies deletes matching keys', async () => {
    (redis.keys as ReturnType<typeof vi.fn>).mockResolvedValue(['rbac:college1:faculty', 'rbac:college1:admin']);
    await invalidatePolicies('college1');
    expect(redis.keys).toHaveBeenCalledWith('rbac:college1:*');
    expect(redis.del).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd backend && npx vitest run src/shared/rbac/__tests__/cache.test.ts
```

Expected: FAIL — module `../cache` not found.

- [ ] **Step 3: Implement cache helpers**

Create `backend/src/shared/rbac/cache.ts`:

```typescript
import redis from '../../config/redis';
import { PolicyDoc } from './types';

const CACHE_TTL = 300; // 5 minutes

function cacheKey(collegeId: string, role: string): string {
  return `rbac:${collegeId}:${role}`;
}

export async function getCachedPolicies(collegeId: string, role: string): Promise<PolicyDoc[] | null> {
  try {
    const cached = await redis.get(cacheKey(collegeId, role));
    if (!cached) return null;
    return JSON.parse(cached) as PolicyDoc[];
  } catch {
    return null; // cache miss on error
  }
}

export async function setCachedPolicies(collegeId: string, role: string, policies: PolicyDoc[]): Promise<void> {
  try {
    await redis.set(cacheKey(collegeId, role), JSON.stringify(policies), 'EX', CACHE_TTL);
  } catch {
    // Non-fatal: proceed without cache
  }
}

export async function invalidatePolicies(collegeId: string): Promise<void> {
  try {
    const keys = await redis.keys(`rbac:${collegeId}:*`);
    for (const key of keys) {
      await redis.del(key);
    }
  } catch {
    // Non-fatal
  }
}

export async function invalidateAllDefaults(): Promise<void> {
  try {
    const keys = await redis.keys('rbac:defaults:*');
    for (const key of keys) {
      await redis.del(key);
    }
  } catch {
    // Non-fatal
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd backend && npx vitest run src/shared/rbac/__tests__/cache.test.ts
```

Expected: 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/shared/rbac/cache.ts backend/src/shared/rbac/__tests__/cache.test.ts
git commit -m "feat(rbac): add Redis cache helpers for policy lookups"
```

---

### Task 6: Policy Evaluation Engine

**Files:**
- Create: `backend/src/shared/rbac/engine.ts`
- Create: `backend/src/shared/rbac/__tests__/engine.test.ts`

- [ ] **Step 1: Write engine tests**

Create `backend/src/shared/rbac/__tests__/engine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { filterPolicies, sortPolicies, matchPersonaType } from '../engine';
import { PolicyDoc } from '../types';

describe('matchPersonaType', () => {
  it('matches exact personaType', () => {
    expect(matchPersonaType('ST-WARDEN', 'ST-WARDEN')).toBe(true);
  });
  it('matches wildcard personaType', () => {
    expect(matchPersonaType('F-HOD-*', 'F-HOD-CSE')).toBe(true);
    expect(matchPersonaType('F-HOD-*', 'F-HOD-ECE')).toBe(true);
  });
  it('rejects mismatched personaType', () => {
    expect(matchPersonaType('ST-WARDEN', 'ST-TPO')).toBe(false);
    expect(matchPersonaType('F-HOD-*', 'F-FAC')).toBe(false);
  });
  it('null policy personaType matches any user personaType', () => {
    expect(matchPersonaType(null, 'ST-WARDEN')).toBe(true);
    expect(matchPersonaType(undefined, 'F-HOD-CSE')).toBe(true);
  });
});

describe('filterPolicies', () => {
  const policies: PolicyDoc[] = [
    { role: 'faculty', module: 'academics', action: 'read', effect: 'allow', priority: 700, isActive: true },
    { role: 'faculty', module: 'academics', action: 'create', effect: 'allow', priority: 700, isActive: true, scope: { subDomain: 'attendance,marks' } },
    { role: 'faculty', module: 'finance', action: 'read', effect: 'deny', priority: 700, isActive: true },
    { role: 'faculty', module: '*', action: 'read', effect: 'allow', priority: 600, isActive: true },
  ];

  it('filters by exact module and action', () => {
    const result = filterPolicies(policies, 'academics', 'read', 'F-FAC');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.module).toBe('academics');
  });

  it('includes wildcard module matches', () => {
    const result = filterPolicies(policies, 'people', 'read', 'F-FAC');
    expect(result.length).toBe(1);
    expect(result[0]!.module).toBe('*');
  });

  it('excludes non-matching module', () => {
    const result = filterPolicies(policies, 'people', 'create', 'F-FAC');
    expect(result.length).toBe(0);
  });
});

describe('sortPolicies', () => {
  it('sorts college-specific before defaults', () => {
    const policies: PolicyDoc[] = [
      { role: 'faculty', module: 'academics', action: 'read', effect: 'allow', priority: 700, isActive: true },
      { role: 'faculty', collegeId: 'college1', module: 'academics', action: 'read', effect: 'deny', priority: 700, isActive: true },
    ];
    const sorted = sortPolicies(policies);
    expect(sorted[0]!.collegeId).toBe('college1');
  });

  it('sorts higher priority first', () => {
    const policies: PolicyDoc[] = [
      { role: 'staff', module: '*', action: 'read', effect: 'allow', priority: 600, isActive: true },
      { role: 'staff', personaType: 'ST-WARDEN', module: 'welfare', action: '*', effect: 'allow', priority: 750, isActive: true },
    ];
    const sorted = sortPolicies(policies);
    expect(sorted[0]!.priority).toBe(750);
  });

  it('sorts exact module before wildcard', () => {
    const policies: PolicyDoc[] = [
      { role: 'faculty', module: '*', action: 'read', effect: 'allow', priority: 700, isActive: true },
      { role: 'faculty', module: 'academics', action: 'read', effect: 'allow', priority: 700, isActive: true },
    ];
    const sorted = sortPolicies(policies);
    expect(sorted[0]!.module).toBe('academics');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd backend && npx vitest run src/shared/rbac/__tests__/engine.test.ts
```

Expected: FAIL — imports not found.

- [ ] **Step 3: Implement the policy engine**

Create `backend/src/shared/rbac/engine.ts`:

```typescript
import { PolicyDoc } from './types';
import { Policy } from '../../models/platform/Policy';
import { getCachedPolicies, setCachedPolicies } from './cache';

/**
 * Match a policy's personaType pattern against a user's personaType.
 * - null/undefined = matches any
 * - 'F-HOD-*' = wildcard suffix match
 * - 'ST-WARDEN' = exact match
 */
export function matchPersonaType(policyPersonaType: string | null | undefined, userPersonaType: string): boolean {
  if (!policyPersonaType) return true; // null = matches all
  if (policyPersonaType.endsWith('*')) {
    const prefix = policyPersonaType.slice(0, -1); // 'F-HOD-' from 'F-HOD-*'
    return userPersonaType.startsWith(prefix);
  }
  return policyPersonaType === userPersonaType;
}

/**
 * Filter policies to those that match the target module, action, and user's personaType.
 */
export function filterPolicies(policies: PolicyDoc[], targetModule: string, targetAction: string, userPersonaType: string): PolicyDoc[] {
  return policies.filter((p) => {
    const moduleMatch = p.module === targetModule || p.module === '*';
    const actionMatch = p.action === targetAction || p.action === '*';
    const personaMatch = matchPersonaType(p.personaType ?? null, userPersonaType);
    return moduleMatch && actionMatch && personaMatch;
  });
}

/**
 * Sort policies by: college-specific first, then exact personaType, then exact module, then priority.
 */
export function sortPolicies(policies: PolicyDoc[]): PolicyDoc[] {
  return [...policies].sort((a, b) => {
    // 1. College-specific before defaults
    const aSpecific = a.collegeId ? 1 : 0;
    const bSpecific = b.collegeId ? 1 : 0;
    if (bSpecific !== aSpecific) return bSpecific - aSpecific;

    // 2. Exact personaType before wildcard before null
    const personaScore = (p: PolicyDoc) => {
      if (!p.personaType) return 0;
      if (p.personaType.endsWith('*')) return 1;
      return 2;
    };
    const pDiff = personaScore(b) - personaScore(a);
    if (pDiff !== 0) return pDiff;

    // 3. Exact module before wildcard
    const moduleScore = (p: PolicyDoc) => (p.module === '*' ? 0 : 1);
    const mDiff = moduleScore(b) - moduleScore(a);
    if (mDiff !== 0) return mDiff;

    // 4. Exact action before wildcard
    const actionScore = (p: PolicyDoc) => (p.action === '*' ? 0 : 1);
    const aDiff = actionScore(b) - actionScore(a);
    if (aDiff !== 0) return aDiff;

    // 5. Higher priority first
    return b.priority - a.priority;
  });
}

/**
 * Load all policies for a user's role + college from cache or DB.
 */
export async function loadPolicies(collegeId: string | undefined, role: string): Promise<PolicyDoc[]> {
  const cacheId = collegeId || 'global';

  // Try cache
  const cached = await getCachedPolicies(cacheId, role);
  if (cached) return cached;

  // Query DB: college-specific + system defaults for this role
  const filter: Record<string, unknown> = {
    role: { $in: [role, '*'] },
    isActive: true,
  };

  if (collegeId) {
    filter.collegeId = { $in: [collegeId, null, undefined] };
  } else {
    filter.collegeId = { $exists: false };
  }

  const docs = await Policy.find(filter).lean();
  const policies: PolicyDoc[] = docs.map((d) => ({
    _id: String(d._id),
    collegeId: d.collegeId ? String(d.collegeId) : undefined,
    role: d.role,
    personaType: d.personaType ?? undefined,
    module: d.module,
    action: d.action,
    effect: d.effect,
    scope: d.scope,
    priority: d.priority,
    description: d.description,
    isActive: d.isActive,
  }));

  // Cache for 5 minutes
  await setCachedPolicies(cacheId, role, policies);

  return policies;
}

/**
 * Evaluate a user's access: load policies, filter, sort, return first match.
 * Returns the matching policy or null (deny).
 */
export async function evaluateAccess(
  collegeId: string | undefined,
  role: string,
  personaType: string,
  targetModule: string,
  targetAction: string,
): Promise<PolicyDoc | null> {
  const policies = await loadPolicies(collegeId, role);
  const filtered = filterPolicies(policies, targetModule, targetAction, personaType);
  const sorted = sortPolicies(filtered);
  return sorted[0] ?? null;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd backend && npx vitest run src/shared/rbac/__tests__/engine.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/shared/rbac/engine.ts backend/src/shared/rbac/__tests__/engine.test.ts
git commit -m "feat(rbac): implement policy evaluation engine with filter/sort/match"
```

---

### Task 7: Rewrite Authorize Middleware

**Files:**
- Modify: `backend/src/middleware/authorize.ts`
- Create: `backend/src/middleware/__tests__/authorize.test.ts`

- [ ] **Step 1: Write authorize middleware tests**

Create `backend/src/middleware/__tests__/authorize.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the engine before importing authorize
vi.mock('../../shared/rbac/engine', () => ({
  evaluateAccess: vi.fn(),
}));

import { authorize } from '../authorize';
import { evaluateAccess } from '../../shared/rbac/engine';
import { AuthRequest } from '../authenticate';
import { Response, NextFunction } from 'express';

function mockReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    user: { id: 'u1', name: 'Test', email: 'test@test.com', role: 'faculty', personaType: 'F-FAC' },
    collegeId: 'college1',
    ...overrides,
  } as AuthRequest;
}

function mockRes(): Response {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
  return res;
}

describe('authorize middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
    // Default: RBAC_ENFORCE is true
    process.env.RBAC_ENFORCE = 'true';
  });

  it('returns 401 if no user', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    const mw = authorize('finance', 'read');
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows access when policy evaluates to allow', async () => {
    const req = mockReq();
    const res = mockRes();
    (evaluateAccess as ReturnType<typeof vi.fn>).mockResolvedValue({ effect: 'allow', priority: 700 });
    const mw = authorize('academics', 'read');
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('denies access when policy evaluates to deny', async () => {
    const req = mockReq();
    const res = mockRes();
    (evaluateAccess as ReturnType<typeof vi.fn>).mockResolvedValue({ effect: 'deny', priority: 700 });
    const mw = authorize('finance', 'create');
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('denies access when no matching policy', async () => {
    const req = mockReq();
    const res = mockRes();
    (evaluateAccess as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const mw = authorize('hr', 'delete');
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows all when RBAC_ENFORCE is false', async () => {
    process.env.RBAC_ENFORCE = 'false';
    const req = mockReq();
    const res = mockRes();
    const mw = authorize('hr', 'delete');
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(evaluateAccess).not.toHaveBeenCalled();
  });

  it('attaches authScope when policy has scope constraints', async () => {
    const req = mockReq();
    const res = mockRes();
    (evaluateAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
      effect: 'allow',
      priority: 700,
      scope: { departmentOnly: true },
    });
    const mw = authorize('academics', 'read');
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.authScope).toBeDefined();
    expect(req.authScope!.departmentOnly).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd backend && npx vitest run src/middleware/__tests__/authorize.test.ts
```

Expected: FAIL — authorize doesn't match expected signature.

- [ ] **Step 3: Rewrite authorize middleware**

Replace `backend/src/middleware/authorize.ts` entirely:

```typescript
import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';
import { evaluateAccess } from '../shared/rbac/engine';
import { AuthScope, RbacOptions } from '../shared/rbac/types';

/**
 * ABAC authorization middleware.
 * Evaluates policies from cache/DB to determine if the user can perform
 * the given action on the given module.
 *
 * When RBAC_ENFORCE env var is 'false', acts as a pass-through (gradual rollout).
 */
export function authorize(module: string, action: string, opts?: RbacOptions) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Feature flag: skip enforcement during rollout
    if (process.env.RBAC_ENFORCE === 'false') {
      req.authScope = {
        departmentOnly: false,
        selfOnly: false,
        userId: req.user.id,
        resolvedPermissions: [],
      };
      return next();
    }

    try {
      const { role, personaType, id: userId } = req.user;
      const collegeId = req.collegeId;

      const policy = await evaluateAccess(collegeId, role, personaType, module, action);

      // No matching policy = deny
      if (!policy || policy.effect === 'deny') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Sub-domain check: if route specifies a subDomain, verify the policy allows it
      if (opts?.subDomain && policy.scope?.subDomain) {
        const allowed = policy.scope.subDomain.split(',').map((s) => s.trim());
        if (!allowed.includes(opts.subDomain)) {
          return res.status(403).json({ error: 'Access denied for this resource' });
        }
      }

      // Attach scope constraints for services to enforce
      const authScope: AuthScope = {
        departmentOnly: policy.scope?.departmentOnly ?? false,
        selfOnly: policy.scope?.selfOnly ?? false,
        userId,
        subDomain: policy.scope?.subDomain ? policy.scope.subDomain.split(',').map((s) => s.trim()) : undefined,
        resolvedPermissions: [],
      };

      // TODO (Task 8+): resolve departmentId from Faculty/Staff record and cache
      // For now, departmentId will be resolved in a follow-up task

      req.authScope = authScope;
      next();
    } catch (err) {
      next(err);
    }
  };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd backend && npx vitest run src/middleware/__tests__/authorize.test.ts
```

Expected: All 6 tests pass.

- [ ] **Step 5: Run typecheck**

```bash
cd backend && npm run typecheck
```

Expected: 0 errors (the old `authorize()` callers may need updates — check for compilation errors and fix).

- [ ] **Step 6: Commit**

```bash
git add backend/src/middleware/authorize.ts backend/src/middleware/__tests__/authorize.test.ts
git commit -m "feat(rbac): rewrite authorize middleware with policy engine evaluation"
```

---

### Task 8: Security Hardening — Authenticate Fix + Rate Limiting + Health

**Files:**
- Modify: `backend/src/middleware/authenticate.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/modules/auth/routes.ts`
- Modify: `backend/src/modules/auth/controller.ts`
- Modify: `backend/src/modules/auth/service.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Install express-rate-limit**

```bash
cd backend && npm install express-rate-limit && npm install -D @types/express-rate-limit
```

- [ ] **Step 2: Fix authenticate.ts — restrict x-college-id to super_admin only**

In `backend/src/middleware/authenticate.ts`, replace the collegeId resolution block inside the `try` block after `req.user = decoded;`:

Find this code:
```typescript
    // Superadmin scopes into a college via x-college-id header; they don't have collegeId in JWT
    const headerCollegeId = req.headers['x-college-id'] as string;
    req.collegeId = headerCollegeId || decoded.collegeId;
```

Replace with:
```typescript
    // Only super_admin can override collegeId via x-college-id header
    const headerCollegeId = req.headers['x-college-id'] as string;
    if (headerCollegeId && decoded.role === 'super_admin') {
      req.collegeId = headerCollegeId;
    } else {
      req.collegeId = decoded.collegeId;
    }
```

- [ ] **Step 3: Add rate limiting and JWT validation to app.ts**

In `backend/src/app.ts`, add after the existing middleware setup (after `app.use(express.json(...))` and before route mounts):

```typescript
import rateLimit from 'express-rate-limit';

// JWT secret validation in production
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret')) {
  console.error('FATAL: JWT_SECRET must be set to a secure value in production');
  process.exit(1);
}

// Global rate limit: 100 requests per minute per IP
app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false }));

// Stricter rate limit on login
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60_000, max: 10, message: { error: 'Too many login attempts. Try again in 15 minutes.' } }));
```

- [ ] **Step 4: Add health endpoint to auth routes**

In `backend/src/modules/auth/routes.ts`, add:

```typescript
router.get('/health', ctrl.health);
```

In `backend/src/modules/auth/controller.ts`, add:

```typescript
export async function health(_req: Request, res: Response) {
  const mongoose = await import('mongoose');
  const redis = (await import('../../config/redis')).default;

  const mongoOk = mongoose.connection.readyState === 1;
  let redisOk = false;
  try {
    await redis.ping();
    redisOk = true;
  } catch { /* redis down */ }

  const status = mongoOk && redisOk ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({
    status,
    mongodb: mongoOk ? 'connected' : 'disconnected',
    redis: redisOk ? 'connected' : 'disconnected',
    uptime: Math.floor(process.uptime()),
  });
}
```

- [ ] **Step 5: Add token refresh endpoint**

In `backend/src/modules/auth/routes.ts`, add:

```typescript
router.post('/refresh', authenticate, ctrl.refresh);
```

In `backend/src/modules/auth/service.ts`, add:

```typescript
export async function refreshToken(userId: string) {
  const user = await User.findById(userId).select('-password');
  if (!user || !user.isActive) throw new AppError(401, 'User not found or inactive');

  const isSuperAdmin = user.role === 'super_admin';
  const payload: Record<string, unknown> = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    personaType: user.personaType,
  };
  if (!isSuperAdmin && user.collegeId) {
    payload.collegeId = String(user.collegeId);
  }

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return { token };
}
```

In `backend/src/modules/auth/controller.ts`, add:

```typescript
export async function refresh(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.refreshToken(req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 6: Run typecheck**

```bash
cd backend && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/middleware/authenticate.ts backend/src/app.ts backend/src/modules/auth/ backend/package.json backend/package-lock.json
git commit -m "feat(security): add rate limiting, collegeId fix, health endpoint, token refresh"
```

---

### Task 9: Seed Default Policies

**Files:**
- Modify: `backend/src/seed.ts`

- [ ] **Step 1: Add policy seeding to seed.ts**

At the end of the seed function in `backend/src/seed.ts`, before the final `console.log('Seed complete')`, add:

```typescript
import { Policy } from './models/platform/Policy';
import { DEFAULT_POLICIES } from './shared/rbac/defaults';

// ... inside the seed function:

// Seed default policies
await Policy.deleteMany({ collegeId: { $exists: false } }); // Clear old defaults
await Policy.insertMany(DEFAULT_POLICIES.map((p) => ({ ...p, createdBy: 'seed' })));
console.log(`Seeded ${DEFAULT_POLICIES.length} default RBAC policies`);
```

- [ ] **Step 2: Run typecheck**

```bash
cd backend && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/seed.ts
git commit -m "feat(rbac): seed default RBAC policies on database setup"
```

---

### Task 10: Add authorize() to All Module Routes

**Files:**
- Modify: all 13 `backend/src/modules/*/routes.ts` files

This is the largest task — every module router needs `authorize(module, action)` added to each route. The pattern is consistent:

```typescript
// Before:
router.get('/', authenticate, ctrl.list);
router.post('/', authenticate, validate(schema), ctrl.create);

// After:
router.get('/', authenticate, authorize('finance', 'read'), ctrl.list);
router.post('/', authenticate, authorize('finance', 'create'), validate(schema), ctrl.create);
```

- [ ] **Step 1: Add authorize import to each module's routes.ts**

Each file needs:
```typescript
import { authorize } from '../../middleware/authorize';
```

- [ ] **Step 2: Add authorize() calls to each route**

For each module, the `authorize` module name matches the route prefix:

| Module directory | authorize module name |
|------------------|-----------------------|
| admissions | `'admissions'` |
| people | `'people'` |
| academics | `'academics'` |
| finance | `'finance'` |
| hr | `'hr'` |
| welfare | `'welfare'` |
| placement | `'placement'` |
| campus-ops | `'campus'` |
| student-dev | `'student-dev'` |
| compliance | `'compliance'` |
| governance | `'governance'` |
| platform | `'platform'` |
| juvi | `'juvi'` |

The action mapping:
- `GET` (list/get) → `'read'`
- `POST` (create) → `'create'`
- `PUT` (update) → `'update'`
- `DELETE` (delete) → `'delete'`

Apply this pattern to every route in every module. For campus-ops routes that serve Library, Facilities, or Communication sub-domains, add the `subDomain` option:

```typescript
// Library routes within campus-ops/routes.ts:
router.get('/books', authenticate, authorize('campus', 'read', { subDomain: 'library' }), ctrl.listBooks);
router.post('/books', authenticate, authorize('campus', 'create', { subDomain: 'library' }), validate(bookSchema), ctrl.createBook);

// Security routes:
router.get('/security-incidents', authenticate, authorize('campus', 'read', { subDomain: 'security' }), ctrl.listSecurityIncidents);
```

- [ ] **Step 3: Run typecheck**

```bash
cd backend && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/*/routes.ts
git commit -m "feat(rbac): add authorize() middleware to all module routes"
```

---

### Task 11: Frontend — Auth Store Permissions

**Files:**
- Modify: `admin-portal/src/stores/authStore.ts`
- Create: `admin-portal/src/hooks/usePermission.ts`

- [ ] **Step 1: Add permissions to auth store**

In `admin-portal/src/stores/authStore.ts`, add to the AuthState interface:

```typescript
permissions: string[];
hasPermission: (module: string, action: string) => boolean;
```

Add to the initial state:
```typescript
permissions: JSON.parse(localStorage.getItem('permissions') || '[]'),
```

Add `hasPermission` implementation:
```typescript
hasPermission: (module, action) => {
  const perms = useAuthStore.getState().permissions;
  return perms.includes(`${module}:${action}`) || perms.includes(`${module}:*`) || perms.includes('*:*');
},
```

Update `setAuth` to accept and store permissions:
```typescript
setAuth: (user, token, collegeId?, colleges?, permissions?) => {
  // ... existing code ...
  localStorage.setItem('permissions', JSON.stringify(permissions || []));
  set({ /* ... existing fields ... */ permissions: permissions || [] });
},
```

Update `logout` to clear permissions:
```typescript
localStorage.removeItem('permissions');
set({ /* ... existing fields ... */ permissions: [] });
```

- [ ] **Step 2: Create usePermission hook**

Create `admin-portal/src/hooks/usePermission.ts`:

```typescript
import { useAuthStore } from '../stores/authStore';

export function usePermission(module: string, action: string): boolean {
  return useAuthStore((s) => s.hasPermission(module, action));
}

export function useCanRead(module: string): boolean {
  return usePermission(module, 'read');
}

export function useCanWrite(module: string): boolean {
  return usePermission(module, 'create');
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd admin-portal && npx tsc --noEmit
```

Expected: 0 errors (may need to adjust setAuth callers — check login page).

- [ ] **Step 4: Commit**

```bash
git add admin-portal/src/stores/authStore.ts admin-portal/src/hooks/usePermission.ts
git commit -m "feat(rbac): add permissions to auth store and usePermission hook"
```

---

### Task 12: Frontend — Sidebar Permission Filtering

**Files:**
- Modify: `admin-portal/src/layouts/DashboardLayout.tsx`

- [ ] **Step 1: Add permission-based sidebar filtering**

In `DashboardLayout.tsx`, find the sidebar navigation items array. Wrap each item with a permission check. The sidebar should hide modules the user can't read.

Add a `permission` field to each nav item and filter:

```typescript
import { useAuthStore } from '../stores/authStore';

// In the component:
const hasPermission = useAuthStore((s) => s.hasPermission);

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, module: null },
  { label: 'Admissions', path: '/admissions', icon: UserPlus, module: 'admissions' },
  { label: 'People', path: '/people', icon: Users, module: 'people' },
  { label: 'Academics', path: '/academics', icon: GraduationCap, module: 'academics' },
  { label: 'Finance', path: '/finance', icon: Wallet, module: 'finance' },
  { label: 'HR', path: '/hr', icon: Briefcase, module: 'hr' },
  { label: 'Welfare', path: '/welfare', icon: Heart, module: 'welfare' },
  { label: 'Placement', path: '/placement', icon: Building2, module: 'placement' },
  { label: 'Campus Ops', path: '/campus-ops', icon: Building, module: 'campus' },
  { label: 'Student Dev', path: '/student-dev', icon: Star, module: 'student-dev' },
  { label: 'Compliance', path: '/compliance', icon: Shield, module: 'compliance' },
  { label: 'Governance', path: '/governance', icon: Landmark, module: 'governance' },
  { label: 'Platform', path: '/platform', icon: Settings, module: 'platform' },
  { label: 'Juvi', path: '/juvi', icon: Bot, module: 'juvi' },
];

// Filter: show items where module is null (dashboard) or user has read access
const visibleItems = navItems.filter(
  (item) => !item.module || hasPermission(item.module, 'read')
);
```

Then render `visibleItems` instead of the full `navItems` in the sidebar JSX.

- [ ] **Step 2: Run typecheck and dev server quick check**

```bash
cd admin-portal && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add admin-portal/src/layouts/DashboardLayout.tsx
git commit -m "feat(rbac): filter sidebar navigation by user permissions"
```

---

### Task 13: Set RBAC_ENFORCE Feature Flag

**Files:**
- Modify: `backend/.env.example` (or `.env`)

- [ ] **Step 1: Add RBAC_ENFORCE=false to env**

In the backend `.env` (or `.env.example`), add:

```
RBAC_ENFORCE=false
```

This ships with enforcement OFF. When ready to enforce, flip to `true`.

- [ ] **Step 2: Commit**

```bash
git add backend/.env.example
git commit -m "feat(rbac): add RBAC_ENFORCE feature flag (default: off for gradual rollout)"
```

---

### Task 14: Final Typecheck and Test Run

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && npm test
```

Expected: All RBAC tests pass.

- [ ] **Step 2: Run full typecheck (both workspaces)**

```bash
npm run typecheck
```

Expected: 0 errors across backend and admin-portal.

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A && git commit -m "fix: resolve typecheck issues from RBAC integration"
```

---

## Deferred to Follow-up Tasks

These items are spec'd but deferred to keep this plan focused:

1. **Department ID resolution** — Look up Faculty/Staff `departmentId` for `departmentOnly` scope enforcement. Requires caching user profile data in Redis.
2. **Resolved permissions in login response** — Compute the full `module:action` list for the frontend after login. Requires running evaluateAccess across all modules.
3. **Policy management admin UI** — `admin-portal/src/pages/platform/Policies.tsx` CRUD page + `admin-portal/src/services/policies.ts` API service.
4. **Policy CRUD endpoints** — Backend routes/controller/service for managing policies via API (under platform module).
5. **Service-layer scope enforcement** — Update all 13 module services to read `req.authScope` and apply `departmentOnly`/`selfOnly` filters.
