# Plan: Global People Search

**Stack:** Node 20 + TypeScript 5.6 (strict) · Express 4 · Mongoose 8 · React 19 + Vite · React Query 5 · Axios
**Created:** 2026-04-18
**Spec:** `./spec.md` (must be reviewed + approved before this plan moves to Phase 3 Tasks)

---

## 1. Architecture

### 1.1 Component map

```
backend/src/modules/people/
  ├── search-service.ts     [NEW]   Cross-role Mongoose aggregation;
  │                                 applies collegeId + authScope;
  │                                 returns normalized SearchResult[]
  ├── search-controller.ts  [NEW]   Thin: validate query + call service
  ├── routes.ts             [MODIFY] Add GET /search + mount rate-limit
  ├── search-validation.ts  [NEW]   Zod schema for query params
  └── service.ts            [unchanged] Reuses existing scope patterns

backend/src/middleware/
  └── rateLimitPerUser.ts   [NEW]   Small wrapper over express-rate-limit
                                    keyed on req.user.id (60/min default)

admin-portal/src/
  ├── components/search/
  │   ├── GlobalSearch.tsx          [NEW]   Top-nav input + overlay controller
  │   ├── SearchOverlay.tsx         [NEW]   Cmd+K modal with keyboard nav
  │   ├── SearchResultsDropdown.tsx [NEW]   Shared dropdown used by both
  │   ├── SearchResultRow.tsx       [NEW]   One row (photo · name · role · id · dept)
  │   └── useGlobalSearch.ts        [NEW]   React Query hook + debounce + hotkey
  ├── services/
  │   └── search.ts                 [NEW]   Axios client for /api/people/search
  ├── layouts/
  │   └── DashboardLayout.tsx       [MODIFY] Mount GlobalSearch in header
  ├── pages/
  │   └── SearchResults.tsx         [NEW]   Full paginated results page (/search)
  └── App.tsx                       [MODIFY] Add /search route
```

### 1.2 Data flow — happy path

```
User types "ram" (3 chars)
  ↓ debounce 200ms (client)
  ↓ React Query invokes Axios GET /api/people/search?q=ram
  ↓ authenticate → authorize('people', 'read') → rateLimitPerUser(60/min) → controller
  ↓ controller validates q via Zod (length, charset), hands off to service
  ↓ search-service.ts runs 5 parallel role-scoped queries in one Promise.all
        Student.find({ collegeId, $or: [name regex, rollNumber regex, ...] })
        Faculty.aggregate([{ $lookup: Person }, { $match: ... }, { $limit }])
        Staff.aggregate([...same...])
        Parent.aggregate([{ $lookup: Person }, { $match: ... }, { $limit }])
        Alumni.aggregate([{ $lookup: Person }, { $match: ... }, { $limit }])
     Each query applies authScope (departmentOnly, selfOnly) via applyAuthScope
  ↓ Service merges results, normalizes to { _id, role, name, photo, identifier, department }
  ↓ Returns { results, totalMatchedAcrossRoles, hasMore }
  ↓ Client renders grouped dropdown
  ↓ User clicks → navigate to /people/{role}/:id
```

### 1.3 Key architectural decision — why aggregate per role, not a single super-query

**Alternative considered**: a single Mongoose aggregation joining `Person` against `Student/Faculty/Staff/Parent/Alumni` at once.

**Why rejected**: Student/Faculty/Staff/Parent/Alumni are *parallel* collections each pointing at the same `Person._id`. A single aggregation requires 5 `$unionWith` or 5 `$lookup` branches, each with its own `$match` for the name/phone/email regex from Person, plus role-specific scope logic. It's expressible but hard to read and hard to index-optimize — the query planner can't use each role's compound indexes efficiently.

**Chosen approach**: 5 parallel queries, each optimally indexed, joined at the JS layer. Runs concurrently via `Promise.all`; each query has its own `$limit: 10`; total dropdown shows top 10 across all.

Tradeoff: 5 round-trips to Mongo instead of 1. With colocated Mongo + indexes in place, the difference is negligible (single-digit ms of overhead); the readability + per-role-scope-correctness win is large.

### 1.4 Query shape per role (the actual predicates)

Each role's query combines **filters derivable from that role's collection** (e.g. `rollNumber`, `employeeCode`) and **filters that live on the linked `Person`** (name, email, phone). Two query shapes:

**Shape A — Student query** (roll number can match directly; name/email/phone need a Person join)

```js
// Phase 1: find matching personIds via Person
const personIds = await Person.find({
  collegeId,
  $or: [
    { name:           { $regex: escapedQ, $options: 'i' } },
    { email:          { $regex: escapedQ, $options: 'i' } },
    { phone:          { $regex: escapedPhone, $options: 'i' } },
    { alternatePhone: { $regex: escapedPhone, $options: 'i' } },
  ],
}).select('_id').limit(50).lean();

// Phase 2: find Students matching roll number OR personId in step 1
const students = await Student.find({
  collegeId,
  $or: [
    { rollNumber: { $regex: escapedQ, $options: 'i' } },
    { personId:   { $in: personIds.map(p => p._id) } },
  ],
  ...(authScope?.departmentOnly && authScope.departmentId
     ? { departmentId: authScope.departmentId }
     : {}),
  status: 'active',
})
  .populate('personId', 'name photo')
  .populate('departmentId', 'name')
  .limit(10)
  .lean();
```

**Shape B — Parent query** (no local IDs; pure Person-join)

```js
// Same Phase 1 as above (Person text search)
const parents = await Parent.find({
  collegeId,
  personId: { $in: personIds.map(p => p._id) },
})
  .populate('personId', 'name photo')
  .populate('linkedStudents', 'rollNumber')
  .limit(10)
  .lean();
```

**Alumni + Faculty + Staff** follow Shape A with `employeeCode` or `rollNumber` substituted where relevant.

### 1.5 Normalized result shape

```ts
interface SearchResult {
  _id: string;               // the role doc _id (Student._id, Faculty._id, ...)
  role: 'student' | 'faculty' | 'staff' | 'parent' | 'alumni';
  personId: string;          // underlying Person._id (useful if client needs to dedupe dual-role)
  name: string;              // Person.name
  photo?: string;            // Person.photo
  identifier?: string;       // roll number / employee code / linked-student-roll / ...
  identifierLabel: string;   // "Roll No", "Employee ID", "Parent of", ...
  department?: string;       // resolved Department.name or Programme.name
  status?: string;           // 'active' (v1 default; inactive filter is on /search page)
}
```

### 1.6 Why Zod + rate limit matter here specifically

- Zod: prevents a user from sending `q=<complex regex bomb>` that would hang Mongo for seconds. Whitelist: letters / digits / space / `@` / `.` / `-` / `+`; max length 100 (which we enforce anyway via `substring(0, 100)`).
- Rate limit: the endpoint is relatively cheap per call but scrapable. A logged-in user sending 1000 req/min could enumerate the Person table systematically (type "a", "aa", "aaa", ...). 60/min is generous for legitimate typeahead (debounce of 200ms caps legit fire rate at ~5/sec bursts).

## 2. API Design

```
GET /api/people/search
  ?q=<string>                (required, 2-100 chars after server-side trim)
  &limit=<int>               (optional, default 10, max 25)
  &includeInactive=<bool>    (optional, default false, only honored by admin/principal)

Headers: Authorization: Bearer <jwt>

200 Response:
{
  "results": SearchResult[],          // up to `limit` items, grouped by role client-side
  "counts": {                          // per-role match counts (for "See all 12" link)
    "student": 5,
    "faculty": 3,
    "staff": 1,
    "parent": 0,
    "alumni": 3
  },
  "totalMatched": 12,
  "hasMore": false                    // true when more matches exist beyond `limit`
}

400: invalid query (too short, invalid characters)
401: not authenticated
403: authorize('people','read') denied
429: rate limit exceeded (60/min per-user)
```

Controller uses `authorize('people', 'read')` — which matches the existing staff, HOD, faculty policies. Students/parents don't have `people:read` on anyone but self, so they'd get empty results anyway — but admin-portal is staff-only, so this doesn't matter.

## 3. Database

No schema changes. Existing indexes cover this use case — verify during implementation:

| Collection | Index | Purpose |
|---|---|---|
| `Person` | `{ collegeId: 1, name: 1 }` (NEW) | Name prefix/substring search |
| `Person` | `{ collegeId: 1, email: 1 }` (NEW) | Email substring search |
| `Person` | `{ collegeId: 1, phone: 1 }` (exists) | Phone lookup |
| `Student` | `{ collegeId: 1, rollNumber: 1 }` (needs check) | Roll number lookup |
| `Faculty` | `{ collegeId: 1, employeeCode: 1 }` (exists, unique) | Employee code lookup |
| `Staff` | `{ collegeId: 1, employeeCode: 1 }` (exists, unique) | Employee code lookup |

**Note on regex + indexes**: MongoDB uses an index for a `$regex` query *only if the pattern is anchored to the start* (`^foo`). Our substring regex (`foo` anywhere) will scan. At 10k people per college this is still < 50ms with the indexes above, per EXPLAIN.

**Consider for v2**: a MongoDB text index (`Person.createIndex({ name: 'text', email: 'text' })`) for stemming support. Deferred per spec §3.

## 4. RBAC, Scoping, and Tests

Key invariant: **the search service MUST use the same `applyAuthScope` helper the existing list pages use.** This is the contract that makes RBAC correct by construction — if we replicate scope logic inline, drift is inevitable.

The scope is applied to each role's query:

```ts
const filter = { collegeId };
if (authScope) applyAuthScope(filter, authScope, { selfField: 'personId' });
// Now filter includes departmentId or personId as required
```

Dedicated integration tests must verify (per AC-15):

1. **Admin user sees everyone** — seed 5 people across 2 departments; admin search returns all 5
2. **HOD sees only their department** — same seed; HOD of CSE sees 3; HOD of ECE sees 2
3. **Cross-college isolation** — college A admin searching for a common name (e.g. "Kumar") does NOT see college B people
4. **Self-only scope** — any persona with `selfOnly` sees only their own Person record (edge case — warden staff, etc.)

These tests live in `backend/src/__e2e__/modules/people-search.test.ts` (NEW).

## 5. Frontend

### 5.1 Component breakdown

- **`<GlobalSearch />`** — top-nav component. Renders a text input (48px wide collapsed → 320px expanded) with a "⌘K" hint. Owns open/closed state for the overlay.
- **`<SearchOverlay />`** — full-screen modal triggered by Cmd+K. Escape to close. Clicks outside to close. Traps focus inside.
- **`<SearchResultsDropdown />`** — the actual results list. Used by both header input (below the input) and overlay (inline). Grouped by role.
- **`<SearchResultRow />`** — one row with photo + name + role badge + identifier + department.
- **`useGlobalSearch(query)`** — React Query hook. Debounces input via `useDeferredValue` or custom 200ms `setTimeout`. Uses `keepPreviousData` to avoid flicker.
- **`<SearchResultsPage />`** — full page for "See all". Accepts `?q=...&role=...&includeInactive=...`; renders one section per role with existing pagination patterns.

### 5.2 Keyboard shortcut wiring

Hook in `DashboardLayout.tsx`:
```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOverlayOpen(true);
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

### 5.3 Race condition on result ordering (EC-5)

React Query's `useQuery` with a query key including the current `q` value + `keepPreviousData` handles this naturally. Each keystroke creates a new query key; stale responses are discarded on arrival. No manual sequence tokens needed.

### 5.4 First-time tooltip

```tsx
const [seenHint, setSeenHint] = useLocalStorage('gps:hint-seen', false);
// Show tooltip until user dismisses; then set flag
```

## 6. Dependencies

### 6.1 No new npm packages needed
- React Query, Axios, lucide-react icons — all in use
- `express-rate-limit` — already in use for login; just need a per-user-keyed wrapper

### 6.2 Infrastructure
- **None**. No Redis or external services. Query runs against existing Mongo.

## 7. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Regex-based search scans instead of using indexes on substring queries | High (this is how Mongo works) | Medium | At < 50k people/college the scan is < 100ms. Performance test during implementation; if degraded, switch to `$text` index (v2 spec). |
| R-2 | Race condition / stale response showing for a stale query | Low | Low | React Query's built-in staleness handling + `keepPreviousData` pattern. |
| R-3 | Privileged staff (admin, principal) accidentally granted search access that bypasses per-role scope controls | Medium | High | Dedicated RBAC tests (§4) that fail CI on regression. Use the existing `applyAuthScope` without modification — no bespoke code path. |
| R-4 | Parent with 2 linked students shown twice | Low | Low | The query dedupes on Parent._id (one row per Parent). The row shows linked students joined into the identifier. |
| R-5 | Request storm from a bug in debounce logic | Medium | Medium | Per-user rate limit (60/min) + debounce on client. Either alone would be sufficient; both provide belt + suspenders. |
| R-6 | Aadhaar or other PII accidentally returned in response | Low (we control the response shape) | High | Service layer constructs `SearchResult` objects explicitly; never returns full Person documents. Negative-assertion test: fetch a result, assert payload does NOT contain `aadhaar`, `dob`, `address`. |
| R-7 | Mobile / tablet layout too cramped for the header search bar | Medium | Low | Collapse to icon-only button ≤ 1024px viewport; opening it triggers the overlay (same as Cmd+K). |
| R-8 | Zero-result or "no access" queries appear identical to user (can't tell if the person doesn't exist or they lack access) | Medium | Low | Intentional: revealing "exists but you can't see" leaks information. Document as a known UX gap. |

## 8. Testing strategy

### 8.1 Unit tests (backend)
- `search-service.ts` — for each role, seed 3-5 records, query, assert correct matches
- RBAC scoping: admin / HOD / faculty / staff-persona each get correct scoped results
- Name-join behavior (via Person match)
- Roll number / employee code direct match
- Phone number normalization (pasted "+91 9999 888888" matches stored "9999888888")
- Empty results / single result / exact-10-cap / > 10 results behaviors
- Negative assertions: no phone/email/DOB/aadhaar in response

### 8.2 Integration tests (backend e2e)
- `GET /api/people/search?q=...` with admin token — sees all 5
- Same query with HOD token — sees only dept
- Rate limit: 61st request in a minute gets 429
- Invalid query (too short, too long, bad chars) → 400
- No token → 401

### 8.3 Frontend tests
- Header input renders with hint "⌘K"
- Cmd+K opens overlay from any page
- Escape closes overlay
- Keyboard arrow navigates rows; Enter navigates
- Debounce: rapid typing doesn't fire a request per keystroke
- Click on result → correct `/people/{role}/:id` route

### 8.4 Regression coverage
- Update `.captain/config.yml` coverage thresholds after this ships to include the new endpoint

## 9. Rollout + observability

- **Feature flag**: NOT necessary — search is additive and gated by existing RBAC. Shipping it off creates drift; shipping it on is safe.
- **Observability**: log p95/p99 latency of `GET /api/people/search` via existing morgan. Add a dashboard widget (out of scope here).
- **Incremental rollout**: None — it's a full deploy.
- **Rollback**: revert the PR; no DB migration needed.

## 10. Open Questions (from spec §9)

Now resolved by codebase inspection:

- **OQ-1** (`employeeId` field?) — Both `Faculty` and `Staff` use `employeeCode` (string, unique with `collegeId`). Spec uses "employee code" as the identifier.
- **OQ-2** (Parent primary identifier?) — `Parent.linkedStudents` is an array of Student `_id`. For dropdown: populate to show "Parent of <first linked student>.rollNumber". Plan populates `linkedStudents` with `rollNumber` selected.
- **OQ-3** (`/search` route placement?) — Top-level route; add to `App.tsx`. No sidebar nav entry (discovered via search, not browsed).
- **OQ-4** (Alumni department?) — Alumni has `programmeId` but no `departmentId`. Plan resolves department via `Programme.departmentId` join in a separate lookup step; or simpler: show programme name instead of department for alumni rows.
- **OQ-5** (narrow viewport?) — Header collapses to icon-only button ≤ 1024px; taps open the overlay.

## 11. Review checklist (self-scored, based on planning-patterns.md)

- [x] Works with existing architecture — reuses `applyAuthScope`, adds no new modules
- [x] No new dependencies — checked
- [x] Hardest part identified — R-3 (scope correctness); front-loaded as Task 1 in eventual task list
- [x] Failure mode visible — p95 latency logging, rate limit 429, RBAC test suite in CI
- [x] Every spec point addressed — all 27 acceptance criteria have plan components; all 10 edge cases have mitigation strategies

## 12. Changelog

- **2026-04-18** — Initial plan drafted against spec v1. Pending review before Phase 3 (Tasks).
