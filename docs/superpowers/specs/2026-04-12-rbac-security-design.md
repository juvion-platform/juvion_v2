# RBAC & Security Hardening — Design Specification

> **Status**: DRAFT | Date: 2026-04-12
> **Scope**: Attribute-Based Access Control (ABAC), security hardening, frontend permission enforcement
> **Modules touched**: All 15 backend modules, Platform (M12) admin UI, DashboardLayout, authStore

---

## 1. Problem Statement

Juvion v2 has working authentication (JWT + collegeId scoping) but no authorization enforcement. Every authenticated user can access every endpoint across all 1,121 API routes. The `authorize()` middleware exists but is a pass-through with a TODO comment.

**Risks**:
- A student can access finance APIs and view all fee records
- A faculty member can modify HR payroll data
- The `x-college-id` header allows any authenticated user to spoof another college's data
- No rate limiting protects the login endpoint from brute force
- JWT secret defaults to `'dev-secret'` if env var is missing

**Goal**: Implement attribute-based access control where permissions are determined by a user's `role`, `personaType`, department, and the target module/action — with college-specific overrides and Redis-cached policy evaluation.

---

## 2. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| ABAC over simple RBAC | ABAC | 28 personas across 13 modules need sub-domain scoping (e.g., warden sees only hostel, HOD sees only their department). Simple role→permission mapping can't express this. |
| `role` for coarse access, `personaType` for fine-grained | Both fields used | `role` (8 values) determines module-level access. `personaType` (28+ values) adds scope constraints like department-only or sub-domain filtering. |
| Fixed defaults + college overrides | Hybrid | System ships with sensible defaults. College admins can grant/revoke specific permissions as exceptions. Overrides stored in DB, defaults in seed data. |
| Redis-cached policies | Yes | Policy evaluation happens on every request. DB lookup per request is unacceptable. Redis cache with 5-min TTL and pub/sub invalidation. |
| Policy-first model | First-match wins | Policies sorted by priority, then specificity. First matching policy determines allow/deny. No match = deny. |

---

## 3. Data Model

### 3.1 Policy Model

New model: `backend/src/models/platform/Policy.ts`

```typescript
interface IPolicy {
  collegeId?: ObjectId;         // null = system default; set = college-specific override
  role: string;                 // 'super_admin' | 'admin' | 'principal' | 'hod' | 'faculty' | 'staff' | 'student' | 'parent' | '*'
  personaType?: string;         // 'ST-WARDEN' | 'F-HOD-*' | null = any personaType for this role
  module: string;               // 'finance' | 'academics' | 'welfare' | '*'
  action: string;               // 'read' | 'create' | 'update' | 'delete' | 'approve' | '*'
  effect: 'allow' | 'deny';
  scope?: {
    departmentOnly?: boolean;   // filter results to user's departmentId
    selfOnly?: boolean;         // filter results to user's own records (userId or personId match)
    subDomain?: string;         // comma-separated sub-domain keys, e.g., 'hostel,mess' or 'attendance,marks'
  };
  priority: number;             // higher number = evaluated first
  description?: string;         // human-readable description for admin UI
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
}
```

**Indexes**:
- `{ collegeId: 1, role: 1, module: 1, isActive: 1 }` — primary lookup
- `{ collegeId: 1, isActive: 1 }` — list all policies for a college

**Seed count**: ~80-100 default policies covering all role×module combinations.

### 3.2 PersonaType Taxonomy

PersonaType values follow a prefix convention:

| Prefix | Meaning | Examples |
|--------|---------|---------|
| `L-` | Leadership | `L-PRIN` (Principal), `L-VPRIN` (Vice Principal), `L-TRUST` (Trust/Management) |
| `F-` | Faculty | `F-FAC` (regular), `F-HOD-CSE` (HOD with department), `F-DEAN-ACAD` (Dean), `F-MENTOR`, `F-LAB` |
| `ST-` | Staff | `ST-ADM` (admissions), `ST-ACC` (accounts), `ST-HR`, `ST-WARDEN`, `ST-TPO`, `ST-EXAM`, `ST-LIB`, `ST-SEC`, `ST-IQAC`, `ST-REG` |
| `S-` | Student | `S-UG`, `S-PG`, `S-HOSTELER` |
| `P-` | Parent | `P-GUARDIAN` |
| `A-` | Alumni | `A-ALUMNI` |
| `E-` | External | `E-RECRUITER`, `E-ASSESSOR` |

The `personaType` field on the User model is updated to use this taxonomy. Existing `L-PRIN` values remain valid.

### 3.3 AuthScope (request-attached)

After policy evaluation, the middleware attaches scope constraints to the request:

```typescript
interface AuthScope {
  departmentOnly: boolean;
  departmentId?: string;        // resolved from user's Faculty/Staff record
  selfOnly: boolean;
  userId: string;               // for selfOnly filtering
  personId?: string;            // for selfOnly filtering on person-linked records
  subDomain?: string[];         // allowed sub-domains, e.g., ['hostel', 'mess']
  resolvedPermissions: string[]; // for frontend: list of 'module:action' strings
}
```

### 3.4 User Model Changes

No schema changes to User. The `role` and `personaType` fields already exist. The `personaType` values will be updated to the new taxonomy for new users; existing users keep their current values (backward-compatible via wildcard matching).

---

## 4. Policy Evaluation Engine

### 4.1 Resolution Algorithm

```
INPUT: user.role, user.personaType, targetModule, targetAction, user.collegeId

1. Load candidate policies from cache:
   key = rbac:{collegeId}:{role}
   If miss, query DB: { collegeId: { $in: [user.collegeId, null] }, role: { $in: [user.role, '*'] }, isActive: true }
   Cache result with TTL 5 min.

2. Filter candidates:
   - module matches targetModule OR module is '*'
   - action matches targetAction OR action is '*'
   - personaType matches user.personaType OR personaType is null OR personaType ends with '*' (wildcard)

3. Sort filtered policies:
   a. College-specific (collegeId set) before defaults (collegeId null)
   b. Exact personaType before wildcard before null
   c. Exact module before '*'
   d. Exact action before '*'
   e. Higher priority number first

4. First match wins:
   - effect = 'allow' → attach scope constraints to req.authScope, proceed
   - effect = 'deny' → return 403

5. No match → return 403 (deny by default)
```

### 4.2 PersonaType Wildcard Matching

PersonaType supports suffix wildcards:
- Policy `personaType: 'F-HOD-*'` matches user `personaType: 'F-HOD-CSE'`, `'F-HOD-ECE'`, etc.
- Policy `personaType: null` matches any personaType for the given role
- Policy `personaType: 'ST-WARDEN'` matches only exact `'ST-WARDEN'`

### 4.3 Scope Resolution

When a policy with `scope` constraints matches:

1. **departmentOnly**: Middleware looks up user's `Faculty.departmentId` or `Staff.departmentId` (cached in Redis alongside the user's session). Attaches `authScope.departmentId`. Services must filter queries by this.

2. **selfOnly**: Attaches `authScope.userId` and `authScope.personId`. Services filter to records owned by or linked to this user.

3. **subDomain**: Attaches `authScope.subDomain` as an array. The controller/service checks that the requested resource's sub-domain tag is in the allowed list. Sub-domain tagging is per-route (see Section 5).

### 4.4 Cache Strategy

| Key Pattern | Value | TTL | Invalidation |
|------------|-------|-----|-------------|
| `rbac:{collegeId}:{role}` | JSON array of policies | 5 min | On policy CRUD: delete keys matching `rbac:{collegeId}:*` |
| `rbac:defaults:{role}` | JSON array of default policies (collegeId=null) | 10 min | On default policy change: delete `rbac:defaults:*` |
| `user:scope:{userId}` | `{ departmentId, personId }` | 15 min | On user/faculty/staff update |

Invalidation uses Redis `DEL` (not pub/sub for simplicity at current scale). If scaling requires it, pub/sub can be added later.

---

## 5. Middleware Implementation

### 5.1 Updated `authorize()` Signature

```typescript
// Usage in routes:
router.get('/', authenticate, authorize('finance', 'read'), listPayments);
router.post('/', authenticate, authorize('finance', 'create'), createPayment);
router.put('/:id', authenticate, authorize('finance', 'update'), updatePayment);
router.delete('/:id', authenticate, authorize('finance', 'delete'), deletePayment);

// Sub-domain scoped:
router.get('/hostel-allocations', authenticate, authorize('welfare', 'read', { subDomain: 'hostel' }), listHostelAllocations);
```

### 5.2 Middleware Pseudocode

```typescript
export function authorize(module: string, action: string, opts?: { subDomain?: string }) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const { role, personaType } = req.user;
    const collegeId = req.collegeId;

    // 1. Load policies (cached)
    const policies = await loadPolicies(collegeId, role);

    // 2. Filter + sort
    const matched = filterAndSort(policies, module, action, personaType);

    // 3. First match
    if (matched.length === 0) return res.status(403).json({ error: 'Access denied' });

    const policy = matched[0];
    if (policy.effect === 'deny') return res.status(403).json({ error: 'Access denied' });

    // 4. Sub-domain check
    if (opts?.subDomain && policy.scope?.subDomain) {
      const allowed = policy.scope.subDomain.split(',').map(s => s.trim());
      if (!allowed.includes(opts.subDomain)) {
        return res.status(403).json({ error: 'Access denied for this sub-domain' });
      }
    }

    // 5. Resolve scope
    req.authScope = await resolveScope(req.user, policy.scope);

    next();
  };
}
```

### 5.3 Service Layer Scope Enforcement

Services receive `authScope` and apply filters:

```typescript
// Example: welfare/service.ts
export async function listHostelAllocations(collegeId: string, authScope: AuthScope, page: number, limit: number) {
  const filter: Record<string, unknown> = { collegeId };
  if (authScope.departmentOnly && authScope.departmentId) {
    filter.departmentId = authScope.departmentId;
  }
  if (authScope.selfOnly) {
    filter.studentId = authScope.personId; // or userId depending on entity
  }
  return paginate(HostelAllocation, filter, page, limit);
}
```

Controllers pass `authScope` through:

```typescript
export async function listHostelAllocations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query;
    const result = await service.listHostelAllocations(req.collegeId!, req.authScope!, +page, +limit);
    res.json(result);
  } catch (e) { next(e); }
}
```

---

## 6. Security Hardening

### 6.1 Rate Limiting

```typescript
// In app.ts
import rateLimit from 'express-rate-limit';

// Global: 100 requests per minute per IP
app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true }));

// Login: 10 attempts per 15 minutes per IP
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60_000, max: 10 }));
```

**Dependency**: `express-rate-limit` (add to backend/package.json).

### 6.2 CollegeId Header Fix

In `authenticate.ts`, restrict header override:

```typescript
// Only super_admin can use x-college-id header to scope into another college
const headerCollegeId = req.headers['x-college-id'] as string;
if (headerCollegeId && decoded.role !== 'super_admin') {
  // Non-superadmin: ignore header, use JWT's collegeId
  req.collegeId = decoded.collegeId;
} else {
  req.collegeId = headerCollegeId || decoded.collegeId;
}
```

### 6.3 JWT Secret Validation

In `app.ts` startup:

```typescript
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret')) {
  console.error('FATAL: JWT_SECRET must be set in production');
  process.exit(1);
}
```

### 6.4 Token Refresh

New endpoint: `POST /api/auth/refresh`

- Input: current valid (non-expired) token in Authorization header
- Output: new token with refreshed expiry (7 days from now)
- The old token remains valid until its original expiry (stateless JWT)
- Rate limited: 5 per hour per user

### 6.5 Health Endpoint

New endpoint: `GET /api/health` (public, no auth)

Returns:
```json
{
  "status": "ok",
  "mongodb": "connected",
  "redis": "connected",
  "uptime": 12345,
  "version": "2.0.0"
}
```

---

## 7. Default Policy Matrix

The seed data ships these default policies. This is the "fixed" base that college admins can override.

### super_admin
- `{ module: '*', action: '*', effect: 'allow', priority: 1000 }`

### admin
- `{ module: '*', action: '*', effect: 'allow', priority: 950 }` (college-scoped by collegeId)

### principal
- `{ module: '*', action: 'read', effect: 'allow', priority: 900 }`
- `{ module: 'governance', action: '*', effect: 'allow', priority: 900 }`
- `{ module: 'compliance', action: '*', effect: 'allow', priority: 900 }`
- `{ module: 'platform', action: '*', effect: 'allow', priority: 900 }`

### hod
- `{ module: 'academics', action: '*', effect: 'allow', scope: { departmentOnly: true }, priority: 800 }`
- `{ module: 'hr', action: 'read', effect: 'allow', scope: { departmentOnly: true }, priority: 800 }`
- `{ module: 'people', action: 'read', effect: 'allow', scope: { departmentOnly: true }, priority: 800 }`
- `{ module: 'student-dev', action: 'read', effect: 'allow', scope: { departmentOnly: true }, priority: 800 }`

### faculty
- `{ module: 'academics', action: 'read', effect: 'allow', priority: 700 }`
- `{ module: 'academics', action: 'create', effect: 'allow', scope: { subDomain: 'attendance,marks,lesson-plans' }, priority: 700 }`
- `{ module: 'academics', action: 'update', effect: 'allow', scope: { subDomain: 'attendance,marks,lesson-plans' }, priority: 700 }`
- `{ module: 'people', action: 'read', effect: 'allow', scope: { departmentOnly: true }, priority: 700 }`

### staff (with personaType scoping)
- `{ personaType: 'ST-ADM', module: 'admissions', action: '*', effect: 'allow', priority: 750 }`
- `{ personaType: 'ST-ACC', module: 'finance', action: '*', effect: 'allow', priority: 750 }`
- `{ personaType: 'ST-HR', module: 'hr', action: '*', effect: 'allow', priority: 750 }`
- `{ personaType: 'ST-WARDEN', module: 'welfare', action: '*', scope: { subDomain: 'hostel,mess' }, priority: 750 }`
- `{ personaType: 'ST-TPO', module: 'placement', action: '*', effect: 'allow', priority: 750 }`
- `{ personaType: 'ST-EXAM', module: 'academics', action: '*', scope: { subDomain: 'exams,results' }, priority: 750 }`
- `{ personaType: 'ST-LIB', module: 'campus', action: '*', scope: { subDomain: 'library' }, priority: 750 }`
- `{ personaType: 'ST-SEC', module: 'campus', action: '*', scope: { subDomain: 'security,gate-pass,visitors' }, priority: 750 }`
- `{ personaType: 'ST-IQAC', module: 'compliance', action: '*', effect: 'allow', priority: 750 }`
- `{ personaType: 'ST-REG', module: 'people', action: '*', effect: 'allow', priority: 750 }`
- Base staff: `{ module: '*', action: 'read', effect: 'allow', priority: 600 }` (read-only fallback)

### student
- `{ module: 'academics', action: 'read', scope: { selfOnly: true }, effect: 'allow', priority: 600 }`
- `{ module: 'finance', action: 'read', scope: { selfOnly: true }, effect: 'allow', priority: 600 }`
- `{ module: 'welfare', action: 'read', scope: { selfOnly: true }, effect: 'allow', priority: 600 }`
- `{ module: 'welfare', action: 'create', scope: { selfOnly: true, subDomain: 'grievance' }, effect: 'allow', priority: 600 }`
- `{ module: 'placement', action: 'read', effect: 'allow', priority: 600 }`
- `{ module: 'placement', action: 'create', scope: { selfOnly: true, subDomain: 'registration' }, effect: 'allow', priority: 600 }`
- `{ module: 'student-dev', action: 'read', effect: 'allow', priority: 600 }`
- `{ module: 'student-dev', action: 'create', scope: { selfOnly: true, subDomain: 'registration,membership' }, effect: 'allow', priority: 600 }`

### parent
- `{ module: 'academics', action: 'read', scope: { selfOnly: true }, effect: 'allow', priority: 500 }`
- `{ module: 'finance', action: 'read', scope: { selfOnly: true }, effect: 'allow', priority: 500 }`
- `{ module: 'welfare', action: 'read', scope: { selfOnly: true }, effect: 'allow', priority: 500 }`

> **Note on parent `selfOnly`**: For parent users, `selfOnly` resolves to their linked children's records (via `Parent.studentIds[]`), not the parent's own records. The scope resolver looks up the parent's linked student IDs and filters queries to those students.

---

## 8. Frontend Changes

### 8.1 Auth Store Updates

After login, the backend returns `resolvedPermissions: string[]` (the list of `module:action` pairs the user has access to, computed from policies). The frontend stores this.

```typescript
// authStore additions:
permissions: string[];           // ['finance:read', 'finance:create', ...]
setPermissions: (perms: string[]) => void;
hasPermission: (module: string, action: string) => boolean;
```

### 8.2 Permission Hook

```typescript
// hooks/usePermission.ts
export function usePermission(module: string, action: string): boolean {
  return useAuthStore(s => s.hasPermission(module, action));
}

// Usage:
const canCreatePayment = usePermission('finance', 'create');
```

### 8.3 Sidebar Filtering

`DashboardLayout.tsx` sidebar items are filtered by `usePermission(module, 'read')`. Modules the user can't read are hidden entirely.

### 8.4 UI Controls

- Create/Edit/Delete buttons wrapped in permission checks
- Forms render as read-only when user has `read` but not `update`
- 403 responses from API show a toast: "You don't have permission to perform this action"

### 8.5 Policy Management Page

New page: `/platform/policies` (accessible to `admin` and `principal` roles)

Features:
- List all policies for the current college (defaults + overrides)
- Create college-specific override (grant or deny a permission for a role)
- Edit/delete overrides (cannot edit system defaults)
- Visual matrix view: roles (rows) x modules (columns) showing allow/deny/scoped

---

## 9. Migration Strategy

This is a non-breaking change. The rollout:

1. **Phase A**: Deploy Policy model + seed defaults + new `authorize()` engine. BUT keep a global feature flag `RBAC_ENFORCE=false` that makes authorize() a pass-through (like today). Ship this silently.

2. **Phase B**: Enable `RBAC_ENFORCE=true` in development/staging. Test all 28 persona paths. Fix policy gaps.

3. **Phase C**: Add `authorize()` calls to all routes. Deploy with `RBAC_ENFORCE=false` in production (middleware present but not blocking).

4. **Phase D**: Enable in production. Monitor 403 rates. Hot-fix policy gaps via DB overrides.

---

## 10. Files Changed

### New Files
| File | Purpose |
|------|---------|
| `backend/src/models/platform/Policy.ts` | Policy model |
| `backend/src/shared/rbac/engine.ts` | Policy evaluation engine |
| `backend/src/shared/rbac/defaults.ts` | Default policy constants (seeded into DB) |
| `backend/src/shared/rbac/types.ts` | AuthScope, PolicyMatch types |
| `backend/src/shared/rbac/cache.ts` | Redis cache helpers for policies |
| `admin-portal/src/pages/platform/Policies.tsx` | Policy management page |
| `admin-portal/src/hooks/usePermission.ts` | Permission check hook |

### Modified Files
| File | Change |
|------|--------|
| `backend/src/middleware/authorize.ts` | Rewrite: policy evaluation engine |
| `backend/src/middleware/authenticate.ts` | CollegeId header fix (super_admin only) |
| `backend/src/modules/auth/service.ts` | Return resolvedPermissions, add refresh, JWT startup check |
| `backend/src/modules/auth/routes.ts` | Add refresh + health endpoints |
| `backend/src/shared/types.ts` | Add AuthScope interface |
| `backend/src/app.ts` | Add rate limiting, JWT validation, health endpoint |
| `backend/src/seed.ts` | Seed default policies |
| `backend/src/modules/*/routes.ts` | Add authorize() calls to all 13 module routers |
| `backend/src/modules/*/service.ts` | Accept + apply authScope in service functions |
| `backend/src/modules/*/controller.ts` | Pass req.authScope to services |
| `admin-portal/src/stores/authStore.ts` | Add permissions array + hasPermission |
| `admin-portal/src/layouts/DashboardLayout.tsx` | Filter sidebar by permissions |
| `admin-portal/src/services/platform.ts` | Add policy CRUD API functions |

---

## 11. Success Criteria

1. `authorize('module', 'action')` middleware is present on all routes across all 15 modules.
2. A student user can only access their own academic, finance, and welfare records via API.
3. A faculty user can only create/update attendance and marks, not finance or HR data.
4. An HOD can only access data within their department.
5. A staff warden can only access welfare:hostel sub-domain.
6. College admins can create override policies via the admin UI.
7. Policy changes invalidate Redis cache within 1 second.
8. Login endpoint is rate-limited to 10 attempts per 15 minutes.
9. Non-superadmin users cannot spoof collegeId via the `x-college-id` header.
10. TypeScript strict mode passes with zero errors.
11. The `RBAC_ENFORCE` feature flag allows gradual rollout.
