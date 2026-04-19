# Tasks: Global People Search

**Spec:** `./spec.md` · **Plan:** `./plan.md` · **Created:** 2026-04-18
**Total tasks:** 11 (9 Code, 2 Doc)

---

## Task DAG

```
    ┌─ T1 (Zod + rate-limit) ──┐
    │                          │
    │                          ├─> T3 (controller + route) ──> T4 (e2e tests)
    │                          │
    └─ T2 (service + indexes) ─┘                              │
                                                              │
                                                              ├──> T5 (FE client)
                                                                   ├─> T6 (hook)
                                                                   ├─> T7 (row + dropdown)
                                                                   │       ├─> T8 (overlay) ──> T9 (header + mount)
                                                                   └─> T10 (/search page + route)
                                                                           │
                                                      T11 (docs) <─────────┘
```

**Parallelism opportunities**:
- T1 and T2 have no dependencies — can run in parallel
- Frontend chain (T5→T6→T7→T8→T9→T10) builds incrementally but individual components can be worked on as soon as T5 lands
- T11 docs can start anytime backend contract is frozen (after T3)

---

## Task list

| # | Task | Type | Depends On | Status |
|---|------|------|------------|--------|
| 1  | Zod query validation + per-user rate-limit middleware | Code | — | Done |
| 2  | Backend `search-service.ts` + Person indexes + unit tests | Code | — | Done |
| 3  | Search controller + route wiring | Code | 1, 2 | Done |
| 4  | E2E integration tests (RBAC scoping, rate limit, PII negative-assertions) | Code | 3 | Done |
| 5  | Frontend axios client (`services/search.ts`) + shared types | Code | 3 | Ready |
| 6  | `useGlobalSearch` React Query hook (debounce + keyboard hotkey) | Code | 5 | Pending |
| 7  | `SearchResultRow` + `SearchResultsDropdown` presentation components | Code | 5 | Pending |
| 8  | `SearchOverlay` (Cmd+K modal, focus trap, keyboard nav) | Code | 6, 7 | Pending |
| 9  | `GlobalSearch` header input + mount in DashboardLayout + Cmd+K hotkey + first-time tooltip | Code | 6, 7, 8 | Pending |
| 10 | `/search` full-results page + route wiring in App.tsx | Code | 5 | Pending |
| 11 | API reference + QA / deploy checklist | Doc | 3, 9, 10 | Pending |

Front-loaded technical risks (from plan §7):
- **R-3 scope correctness** — T2's acceptance criteria include the RBAC dedicated tests; this is the biggest correctness risk and gets covered early
- **R-1 regex + index perf** — T2 adds the Person indexes; T4 includes a load-shaped e2e test
- **R-6 PII leakage** — T2 and T4 both include negative assertions ("response does NOT contain aadhaar/dob/...")

---

# Task details

---

### Task 1: Zod query validation + per-user rate-limit middleware
**Type:** Code → captain-tdd
**Status:** Ready
**Depends On:** —

**Acceptance Criteria (maps to spec §5.6 + plan §1.6):**
- New file `backend/src/modules/people/search-validation.ts` exports a Zod schema `searchQuerySchema` that validates query params:
  - `q`: string, 2–100 chars after trim, whitelist `[A-Za-z0-9 @.\-+]`
  - `limit`: optional int, 1–25, default 10
  - `includeInactive`: optional boolean, default false
- Invalid `q` (too short, too long, disallowed chars) → Zod error surfaces as 400 via existing `validate` middleware
- New file `backend/src/middleware/rateLimitPerUser.ts` exports a factory `createUserRateLimit({ max, windowMs })` returning an `express-rate-limit` middleware keyed on `req.user.id`
- Default used by the search route: `createUserRateLimit({ max: 60, windowMs: 60_000 })`
- Unauthenticated requests fall through to the existing global per-IP limit (no change)
- Over-limit response is 429 with JSON body `{ error: 'rate_limited', retryAfter: <seconds> }`
- Unit tests (vitest, no Mongo needed):
  - Zod accepts `q: "ab"`, rejects `q: "a"` (too short) and `q: "<script>alert(1)</script>"` (disallowed chars)
  - Zod normalizes whitespace: leading/trailing trimmed
  - Rate limit: burst of 60 requests from user X within 1 minute all pass; 61st returns 429
  - Rate limit: user X's limit does NOT affect user Y's bucket

**Context:** These are the two "entry guards" for the search endpoint. Independent of any other work — good first task. The rate-limit middleware is reusable beyond this feature; place it in `shared/middleware/` if the existing pattern warrants (existing `express-rate-limit` usage in `app.ts`).

**Testing reuse**: vitest only (no DB). Pure in-memory tests for both.

---

### Task 2: Backend `search-service.ts` + Person indexes + unit tests
**Type:** Code → captain-tdd
**Status:** Refactored
**Depends On:** —
**Completed:** 2026-04-19 — 16/16 tests passing, 242/242 full suite, typecheck clean. See `completions/task-2.md`.

**Acceptance Criteria (maps to spec §5.2, §5.3, §5.4; plan §1.4, §4):**
- New file `backend/src/modules/people/search-service.ts` exports `searchPeople(collegeId: string, query: string, opts: { limit?: number; includeInactive?: boolean; authScope?: AuthScope }): Promise<SearchResponse>` where `SearchResponse` = `{ results: SearchResult[]; counts: Record<Role, number>; totalMatched: number; hasMore: boolean }`
- `SearchResult` shape exactly matches plan §1.5 (no phone/email/DOB/address/aadhaar)
- Implementation runs 5 parallel role-scoped queries via `Promise.all` (Student, Faculty, Staff, Parent, Alumni)
- Each role's query applies `applyAuthScope(filter, authScope, { selfField: 'personId' })` — uses existing helper unmodified
- Substring matching is case-insensitive across: Person.name, Person.email, Person.phone (and Person.alternatePhone), Student.rollNumber, Faculty.employeeCode, Staff.employeeCode
- Phone query normalization: strip non-digit characters from `q` before phone-match; match against similarly-normalized stored value. `"+91 9999 888888"` matches stored `"9999888888"`.
- Per-role result limit = `min(limit, 10)`; total dropdown shows `limit` rows across roles (client slices)
- `hasMore` is true when any role's match count exceeds its per-role limit
- `includeInactive: false` (default) excludes `status !== 'active'` from Student/Faculty/Staff results (Parent/Alumni have no status field — included unconditionally)
- Defensive: query is truncated to first 100 chars server-side even if validation allowed longer
- Defensive: regex special characters in `q` are escaped before use (`.\*+?^$(){}[]|\`) so a user can't craft a regex bomb
- Compound indexes added to Person schema: `{ collegeId: 1, name: 1 }`, `{ collegeId: 1, email: 1 }` — via `Person.ts`
- Unit tests (vitest + mongodb-memory-server via existing `helpers/mongoMemory.ts`):
  1. **Admin scope** — seed 5 people across 2 departments; admin search returns all 5
  2. **HOD scope** — same seed; HOD of CSE returns 3, HOD of ECE returns 2 (scoping correctness)
  3. **Cross-college isolation** — search in college A does not surface college B people
  4. **Name substring** — query `ram` matches "Ramesh", "Arunabh Ramaswamy", case-insensitively
  5. **Phone normalization** — query `+91 9999 888888` matches stored `9999888888`
  6. **Roll number direct match** — query `22JIT0001` matches the student with that roll number
  7. **Employee code direct match** — for faculty + staff separately
  8. **Parent dedup** — a parent with 2 linked students appears once with both students joined into identifier
  9. **Alumni via programme** — resolves `programmeId` → programme name for the `department` field
  10. **includeInactive=false excludes separated staff** (Student `graduated`, Faculty `separated`)
  11. **PII negative assertion** — no result includes phone, email, DOB, aadhaar, address anywhere in the payload (not even nested)
  12. **Regex escape safety** — query `.` does NOT match every record; query `*` does NOT crash
  13. **Rate of results** — query matching 50+ records still returns only `limit` items; `hasMore: true`

**Context:** This is the highest-risk task in the feature (correctness bar is high, scope logic is subtle). Front-load it and front-load its test coverage. If any test is hard to express, likely means the design has a seam problem worth exploring before proceeding.

**Testing reuse**: reuse `setupMongo` / `teardownMongo` / `clearCollections` from `backend/src/__tests__/helpers/mongoMemory.ts`. For seeding multi-role people, consider a small test helper `seedPersonWith(role, opts)` in the test file (not global — scope it).

**Risk callout:** R-3 (RBAC scope bypass) — tests 1, 2, 3, 10 lock this down. R-6 (PII leak) — test 11. R-1 (regex perf) — addressed by the new compound indexes; Phase 2 perf test deferred to T4.

---

### Task 3: Search controller + route wiring
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 1, 2

**Acceptance Criteria (maps to plan §2):**
- New file `backend/src/modules/people/search-controller.ts` exports `searchPeople(req, res, next)` function:
  - Validates via the Zod middleware from T1 (already applied at route level; controller trusts `req.body` / `req.query`)
  - Calls `searchService.searchPeople(req.collegeId!, req.query.q, { limit, includeInactive, authScope: req.authScope })`
  - Returns 200 + JSON per plan §2
  - Honors `includeInactive=true` only when `req.user.role ∈ {'admin', 'principal', 'super_admin'}`; silently downgrades to `false` for others (AC preserves least surprise — log at info level)
- `backend/src/modules/people/routes.ts` registers `GET /search` with the middleware chain:
  ```
  router.get('/search',
    authenticate,
    authorize('people', 'read'),
    createUserRateLimit({ max: 60, windowMs: 60_000 }),
    validate(searchQuerySchema),  // reads from req.query, not req.body — needs validate to support query
    ctrl.searchPeople,
  );
  ```
- `validate()` middleware may need a tiny extension to support `req.query` (it currently validates `req.body`); either extend with `validate(schema, source: 'body' | 'query')` OR use a dedicated `validateQuery` middleware — pick the less-invasive option
- Integration tests (supertest + mongodb-memory-server):
  - 200 happy path with valid token + valid query
  - 400 with missing `q`
  - 400 with `q` too short / invalid chars
  - 401 without auth
  - 403 with authenticated user lacking `people:read`
  - 429 on the 61st request within 60s

**Context:** Thin controller, standard route pattern. Depends on both T1 (middleware) and T2 (service). The `validate()` extension for query params is the one micro-scope-creep to watch for — flag if the existing middleware needs changes.

**Testing reuse**: existing e2e pattern in `backend/src/__e2e__/modules/*.test.ts` + `helpers/request.ts`.

---

### Task 4: E2E integration tests
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 3

**Acceptance Criteria (maps to spec §5 across the board):**
- New file `backend/src/__e2e__/modules/people-search.test.ts`:
  - All 6 HTTP contract tests from T3 acceptance criteria
  - **RBAC end-to-end**: use `createTestUser` + `createTestStudent`/`createTestFaculty` factories to seed users of different roles (admin, HOD, faculty, staff-with-persona); assert each token sees the scoped results
  - **Rate-limit across requests**: 62 calls within 1 minute; assert the 61st+ is 429
  - **Response shape assertion**: exact JSON-schema match against plan §2 response (counts per role, hasMore flag)
  - **PII negative assertion**: at the HTTP boundary (not just service), response body contains no `phone`, `email`, `dob`, `aadhaar`, `address` fields
  - **Pagination via includeInactive**: admin calls `?q=smith&includeInactive=true`, gets separated/graduated records too
  - **Latency sanity**: seed 500 synthetic records across 5 colleges; p95 query < 300ms (relaxed for CI; primarily catches catastrophic regressions, not fine-grained perf)
- Re-runs existing test suite green: `npm test` backend → 100% pass (no regression)

**Context:** The full compliance check. Catches integration bugs that unit tests miss — middleware ordering, token-to-scope resolution, response shaping. Also acts as the live doc for API consumers.

**Testing reuse**: `backend/src/__e2e__/helpers/request.ts`, `backend/src/__e2e__/factories/*.ts`, existing `seedBase()`.

---

### Task 5: Frontend axios client + shared types
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 3 (endpoint shape must be known)

**Acceptance Criteria:**
- New file `admin-portal/src/services/search.ts`:
  - Exports `searchPeople(params: { q: string; limit?: number; includeInactive?: boolean; signal?: AbortSignal }): Promise<SearchResponse>` — uses the project's existing axios instance
  - Exports `SearchResult` and `SearchResponse` TypeScript types matching the backend's response contract
  - Uses `AbortSignal` support for request cancellation (React Query passes one via queryFn)
- A tiny unit test (vitest + `msw` or fetch mock) verifying: a 200 response is parsed into `SearchResponse`; a 429 response throws with a retryable marker

**Context:** Thin wrapper. Keep identical to how `services/campus.ts` and others are structured. Shape the types so downstream components import from here, not from the backend module.

**Testing reuse**: existing frontend test utilities (if any); if none, a simple `vi.fn(axios.get)` mock is enough.

---

### Task 6: `useGlobalSearch` React Query hook
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 5

**Acceptance Criteria (maps to spec §5.1, §5.6; plan §5.3):**
- New file `admin-portal/src/components/search/useGlobalSearch.ts`:
  - Signature: `useGlobalSearch(opts?: { enabled?: boolean })` returns `{ query, setQuery, results, counts, totalMatched, hasMore, isLoading, error, isOpen, setOpen }`
  - Internal debounce via `useDeferredValue` or a custom 200ms `setTimeout` hook
  - Query fires only when `deferredQuery.length >= 2`
  - Wraps React Query `useQuery` with queryKey `['globalSearch', deferredQuery, opts.includeInactive]`, `keepPreviousData: true`, `placeholderData`
  - Exposes a `useGlobalSearchHotkey()` companion hook or side effect that listens for Cmd+K / Ctrl+K and calls `setOpen(true)`
- Tests:
  - Debounce: rapid calls to `setQuery` across < 200ms fire only 1 request
  - Min-length: `setQuery('a')` does not fire a request
  - Stale response: older-query result is replaced by newer-query result (React Query's built-in behavior — just assert the final rendered results match the latest query)

**Context:** Single source of truth for the search state; both the header input and the overlay consume it. Do NOT duplicate debounce logic elsewhere.

---

### Task 7: `SearchResultRow` + `SearchResultsDropdown` components
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 5 (types)

**Acceptance Criteria (maps to spec §5.3; plan §1.5, §5.1):**
- New file `admin-portal/src/components/search/SearchResultRow.tsx`:
  - Props: `{ result: SearchResult; selected?: boolean; onClick(): void; onHover?(): void }`
  - Renders: photo thumbnail (fallback to initial), name, role-colored badge (Student/Faculty/Staff/Parent/Alumni), identifier label + value, department/programme name
  - Styling: consistent with existing list-row patterns in `admin-portal/src/pages/people/*`
- New file `admin-portal/src/components/search/SearchResultsDropdown.tsx`:
  - Props: `{ results, counts, totalMatched, hasMore, query, selectedIndex, onSelect(index): void, onSeeAll(): void, state: 'idle' | 'typing' | 'loading' | 'empty' | 'error' }`
  - Groups rows by role with a section header per role (e.g. `Students · 5`)
  - Renders `See all N results →` link when `hasMore`
  - Empty state: "No people match '{query}'." distinct from idle ("Type at least 2 characters").
  - Error state: "Couldn't search — click to retry" with retry hook
  - Semantically a listbox with `role="listbox"` and rows `role="option"` for accessibility
- Unit tests (vitest + `@testing-library/react` — if installed):
  - Groups rows by role
  - Shows "See all" link only when `hasMore`
  - Empty state vs idle state vs loading state render distinctly
  - Clicking a row calls `onSelect` with correct index

**Context:** Pure presentation — no data fetching. Used by both `SearchOverlay` and header input. Keep it dumb; state lives in the hook.

---

### Task 8: `SearchOverlay` component
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 6, 7

**Acceptance Criteria (maps to spec §5.1, AC-21):**
- New file `admin-portal/src/components/search/SearchOverlay.tsx`:
  - Full-screen modal (z-index above app content), centered input at top
  - Controlled by `isOpen` from `useGlobalSearch`
  - Focus traps the search input when open
  - Esc closes; click on backdrop closes
  - Arrow Down / Arrow Up moves `selectedIndex` through results (wraps at bounds)
  - Enter navigates to `/people/{role}/:id` for the selected result
  - Tab from input cycles to "See all results" focusable link
  - Uses `SearchResultsDropdown` inline (not floating)
  - CSS: uses existing project Tailwind tokens, no new palette colors
- Tests:
  - Focus trap active when open (`@testing-library/user-event` → Tab cycles only inside modal)
  - Esc calls `setOpen(false)`
  - Arrow keys update selectedIndex
  - Enter triggers navigation
  - Body scroll locked while open (common UX expectation)

**Context:** Biggest single frontend component. Keyboard behavior is the subtle part — make sure it mirrors how `/pages/people/*` pages handle keyboard. If a shared focus-trap utility exists, reuse it.

---

### Task 9: `GlobalSearch` header component + mount + hotkey + first-time tooltip
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 6, 7, 8

**Acceptance Criteria (maps to spec §5.1, §5.7):**
- New file `admin-portal/src/components/search/GlobalSearch.tsx`:
  - Renders: collapsed search icon on narrow viewports (≤ 1024px) that opens the overlay on click; expanded search input on wide viewports with a trailing `⌘K` hint pill
  - On wide viewports: typing in the header input ALSO shows the dropdown below the input (not the full overlay) so the user can stay where they are
  - On any viewport: Cmd+K / Ctrl+K opens the overlay, focuses its input
  - First-time tooltip: if `localStorage['gps:hint-seen'] !== 'true'`, show a one-line tooltip "New: press ⌘K to search for anyone" pointing at the search icon; click-to-dismiss sets the flag
- Mount point: `admin-portal/src/layouts/DashboardLayout.tsx` — place the component in the existing header area (around line 139, next to the user avatar)
- Cmd+K hotkey is wired at the Layout level (not per-component), so it works from any page rendered inside the layout
- Tests:
  - Renders collapsed icon at ≤ 1024px (test via CSS viewport mock)
  - Renders expanded input at > 1024px with visible "⌘K" hint
  - Cmd+K opens overlay from any mounted page
  - First-time hint shows for a fresh user, stays hidden after dismiss

**Context:** Integration point that brings hooks + components together. Pay attention to the overlay-vs-inline-dropdown UX split — easy to get confused. Rule: overlay always covers full screen; inline dropdown only renders below a visible input, never full screen.

---

### Task 10: `/search` full-results page + route
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 5

**Acceptance Criteria (maps to spec §4.5, AC-14):**
- New file `admin-portal/src/pages/SearchResults.tsx`:
  - Reads `?q=<string>` and optional `?includeInactive=true` from URL params
  - Calls `searchPeople` with a larger limit (e.g. 25 per role)
  - Renders one section per role with:
    - Role heading + count
    - Existing list-row style (reuse patterns from `/pages/people/*`)
    - Per-role pagination (Load More or page-numbered; match existing pattern)
    - A toggle at top of page: `[ ] Include inactive / separated` (only visible to admin/principal)
  - Empty state: same copy as dropdown
  - Breadcrumb: `Search > "<query>"`
- Route wired in `admin-portal/src/App.tsx` under `/search`
- Only accessible to authenticated users (existing auth guard)

**Context:** Destination for the "See all N results" link. Keep it consistent with existing `/people/*` list pages — reuse their filter + pagination components where possible.

---

### Task 11: API reference + QA / deploy checklist
**Type:** Doc → captain-spec direct
**Status:** Pending
**Depends On:** 3, 9, 10

**Expected state:**
- New file `backend/docs/api/people-search.md`:
  - Audience: backend devs + frontend integrators
  - Endpoint: `GET /api/people/search`
  - Query params table (q, limit, includeInactive)
  - Response shape with example JSON
  - Error responses (400, 401, 403, 429) with examples
  - Rate limits documented
  - PII guarantees (what IS returned, what is NOT)
  - RBAC behavior (what each role sees)
- New section in `docs/tech-debt-remediation-plan.md` or a separate deploy checklist:
  - Indexes-to-create checklist: `Person.{collegeId, name}`, `Person.{collegeId, email}` — whether auto-applied by Mongoose `syncIndexes()` or need a manual step on existing collections
  - Observability checklist: verify p95 latency tracked for the new endpoint
  - Manual QA flows: super-admin, admin, HOD, faculty-with-persona, warden — each runs a 3-query smoke test (common name, roll number, phone number) and verifies scope correctness

**Verification**: Both files exist and cover all the items in the expected-state list. Tech writer (me) follows the existing doc style in `backend/docs/api/campus-allocations.md`.

---

## Spec-to-task traceability

| Spec section | Covered by |
|---|---|
| §5.1 Triggering + input | T6, T8, T9 |
| §5.2 Query matching | T2 |
| §5.3 Result shape + filtering | T2, T5, T7 |
| §5.4 Privacy / PII | T2, T4 (negative assertions) |
| §5.5 Click behavior | T8, T9 |
| §5.6 Performance + abuse | T1, T2 (regex escape), T4 (latency test), T6 (debounce) |
| §5.7 Discoverability | T9 (first-time tooltip) |
| §6 edge cases (10 total) | Distributed: EC-1 T2 · EC-2 T2 · EC-3 T2 · EC-4 deferred · EC-5 T6 · EC-6 T2 · EC-7 T6 · EC-8 T2 · EC-9 T7 · EC-10 T2/T10 |
| §8 success metrics | Observability checklist in T11 |

All 27 acceptance criteria trace to ≥1 task; all 10 edge cases have either explicit coverage or a documented rationale for deferral (only EC-4 — `q=<ObjectId>` special case — is deferred per spec).

---

## Changelog

- **2026-04-18** — Initial task list drafted from spec + plan. 11 tasks, 2 independent starters (T1 + T2).
