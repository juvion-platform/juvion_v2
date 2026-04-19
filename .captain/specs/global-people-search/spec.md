# Spec: Global People Search

**Feature slug:** `global-people-search`
**Owner:** srinivasarao.kandula@mediamint.com
**Phase:** 1 — Specify (pending review before Plan → Tasks → Implementation)
**Created:** 2026-04-18

---

## 1. Problem Statement

Finding a specific person in the Juvion v2 admin portal today requires navigating to the right role's list page (`/people/students`, `/people/faculty`, `/people/staff`, `/people/parents`, `/people/alumni`), then filtering or paginating. There's no unified way to search by name across all roles — a warden looking for "Ramesh Kumar" doesn't know whether Ramesh is a current student, an alumnus, or a parent.

Power users (admissions officers, finance staff, HODs) do this dozens of times per day. Multiplied across all staff, that's meaningful friction.

## 2. Goals

- One search entry point — typing a name/ID from *anywhere* in the admin portal returns matching people across all 5 internal person roles
- RBAC-aware — users only see people they're already allowed to see via existing scope rules (department/self)
- Fast enough to feel instant — type-ahead results appearing before you finish typing a surname
- Respects existing PII protection — the search response shows name + role + one identifier, never phone/email/DOB/Aadhaar

## 3. Non-Goals (explicit "NOT for v1")

- **External persons** (recruiters, vendors, visiting examiners) — out of scope; accessed through Placement/Procurement pages
- **Student/parent portals** — admin-portal is staff + management only; no other portal gets this search
- **Aadhaar lookup** — PII exposure risk; belongs in a dedicated identity-verification flow
- **Typo tolerance / fuzzy search** — v1 is case-insensitive substring. Fuzzy (Atlas Search, Meilisearch) is a v2 upgrade if users complain
- **Search-by-department-keyword** (e.g. typing "CSE 2023" to filter) — list pages already have those filters; global search is for finding a *specific person*
- **Quick actions in dropdown** (send email, trigger fee query, etc.) — v1 navigates to the detail page, no inline actions
- **Cross-college search** (super-admin seeing people across all colleges) — multi-tenant boundary is strict; super-admin scopes to current `collegeId` like everyone else
- **Search-endpoint audit logging** — click-through to detail pages remains audited via existing per-page logic; the search query itself is not logged in v1

## 4. User Journeys

### 4.1 Warden searches for a student on the hostel dashboard

1. Warden is viewing `/welfare/hostel-blocks` and remembers she needs to check Ramesh Kumar's room assignment
2. She presses **Cmd+K** (or clicks the search icon in the top nav)
3. Search overlay opens, input focused
4. She types `ramesh` (6 chars; debounce fires after 200ms)
5. Dropdown shows grouped results: `3 Students · 1 Faculty · 1 Alumni`
6. She sees "Ramesh Kumar · Student · CSE · 22JIT0154" and clicks it
7. Navigates to `/people/students/<id>` where she sees his hostel allocation

### 4.2 HOD searches from the top nav bar

1. HOD of CSE is on the Dashboard page
2. The top-nav search bar is always visible; she types `priya` directly into it
3. After 200ms debounce: dropdown shows **only CSE people** (her department) — 5 students, 1 faculty
4. She clicks "Priya Sharma · Faculty · CSE"
5. Navigates to `/people/faculty/<id>`

Key behavior: **the same search returns different results depending on who's asking**. HOD sees department-scoped; admin sees college-scoped.

### 4.3 Admissions officer finds a parent by phone number

1. Parent calls the admissions office asking about their son's fee
2. The officer opens the search overlay (Cmd+K), types the last 6 digits of the parent's phone
3. Match found: "Sunitha Reddy · Parent · linked to Arjun Reddy" — displayed as the identifier on the row
4. Click → parent detail page shows the linked student

### 4.4 Search returns zero results

1. User types `xyzabc`
2. Dropdown shows: "No people match 'xyzabc'" + a "Search across all colleges (admin)" link for super-admin users (out of v1 scope — shown grayed with "coming soon")
3. User closes with Esc, tries again

### 4.5 Power-user flow: "see all results"

1. User searches `sharma`; 12 matches exist but dropdown shows top 10 across roles
2. "See all 12 results →" link at bottom of dropdown
3. Click → `/search?q=sharma` — a full page with a proper paginated list per role, all filterable by department/status/etc.

## 5. Acceptance Criteria

Each bullet independently testable.

### 5.1 Triggering + input

- **AC-01**: Cmd+K (macOS) / Ctrl+K (Windows/Linux) opens the search overlay from any admin-portal page where the user is authenticated
- **AC-02**: The top-nav header has a persistent search input that focuses on click
- **AC-03**: Typing into either input (header bar or overlay) triggers the same search flow
- **AC-04**: Esc closes the overlay; clicking outside the overlay closes it
- **AC-05**: Queries fire after 200ms of no-keystroke activity (debounce)
- **AC-06**: Queries with fewer than 2 characters do not fire; dropdown shows a helpful prompt ("Type at least 2 characters")

### 5.2 Query matching

- **AC-07**: Search matches case-insensitively as a substring against the person's **name**
- **AC-08**: Search also matches against the person's **email**, **phone** (primary + alternate), **rollNumber** (students), and **employeeId**/**staffId** equivalents (faculty, staff)
- **AC-09**: Whitespace in the query is treated as an AND (e.g. "ram kum" matches "Ramesh Kumar" and "Kumar Ramaswamy" but not "Ram Singh")
- **AC-10**: The query NEVER matches against Aadhaar, DOB, or address — those fields are not indexed for search

### 5.3 Result shape + filtering

- **AC-11**: Each result includes: `_id`, `name`, `role` (`student|faculty|staff|parent|alumni`), `photo` URL (if set), one primary identifier (rollNumber for students, employeeId for faculty/staff, linked-student's name for parents, year-of-passout for alumni), and the person's department or programme name
- **AC-12**: Results are grouped by role in the dropdown, with a role count header ("5 Students · 3 Faculty")
- **AC-13**: Top 10 results total across all roles (grouped) shown in the dropdown; if more exist, a "See all N results" link to `/search?q=<query>` is rendered at the bottom
- **AC-14**: Full results page (`/search?q=<query>`) shows paginated results per role (one section per role) with the existing list-page per-role filters available
- **AC-15**: RBAC filtering: results are constrained by the current user's `authScope` exactly as the role-specific list pages are. HOD gets `departmentOnly`. Admin/principal sees everyone in college. `selfOnly` scopes (if any staff persona triggers them) scope correctly.
- **AC-16**: Multi-tenancy: only people whose `collegeId` matches the current user's scope are returned

### 5.4 Privacy / PII

- **AC-17**: The search response does NOT include phone, email, DOB, Aadhaar, or address — those fields stay behind the detail page's RBAC gate
- **AC-18**: Search matching on phone returns the person but the phone value itself is not in the response payload
- **AC-19**: No new audit log is created for the search query itself. The click-through to `/people/{role}/:id` remains audited by existing logic on those pages.

### 5.5 Click behavior

- **AC-20**: Clicking a result closes the dropdown/overlay and navigates to:
    - Student → `/people/students/<id>`
    - Faculty → `/people/faculty/<id>`
    - Staff → `/people/staff/<id>`
    - Parent → `/people/parents/<id>`
    - Alumni → `/people/alumni/<id>`
- **AC-21**: Keyboard: arrow keys move selection; Enter navigates; Tab cycles to the "See all results" link

### 5.6 Performance + abuse protection

- **AC-22**: Single search query completes in < 300ms p95 at a college with 10,000 people (measured via `console.time` in dev + APM in prod)
- **AC-23**: Per-user rate limit: 60 requests/minute (keyed on `req.user.id`); 429 + friendly message beyond that
- **AC-24**: Existing global per-IP rate limit (100/min) remains in force
- **AC-25**: The search endpoint returns within 10s hard timeout even on degenerate queries; no endless query

### 5.7 Discoverability

- **AC-26**: Small "⌘K" hint next to the search icon in the top nav (hidden on mobile)
- **AC-27**: First-time visitors to the dashboard after rollout see a one-time tooltip: "New: press ⌘K to search for anyone" (dismissable; stored in localStorage so it never reappears)

## 6. Edge Cases

- **EC-1 — Dual-role people**: a person could be both a Parent (linked to their child) AND an Alumni (they studied here 20 years ago). Spec: show them in BOTH groups if query matches — the `_id` on `Person` is shared, but the `role` identity is per-row (`Alumni` vs `Parent` records).
- **EC-2 — Pasted phone with country code**: user pastes "+91 9999 888888" into the search. Spec: normalize to digits only before matching (`/\d/g.replace`), match against the stored phone also normalized the same way.
- **EC-3 — Very long query (1000+ chars)**: spec: truncate to first 100 chars server-side before matching; don't reject.
- **EC-4 — Query exactly equal to an ObjectId string** (24 hex chars): the spec treats it as a text query; ObjectId lookup is NOT a special case in v1. If someone copies an ID and pastes it, they won't find anything useful — they should use the URL directly.
- **EC-5 — Concurrent queries racing**: if a user types "sh", then "sha", then "shar" in rapid succession, only the latest response should render. Frontend uses a sequence token or React Query's built-in staleness handling. The two earlier responses are discarded on arrival.
- **EC-6 — User has no RBAC access to *any* person**: e.g. a new staff account that hasn't been persona-tagged yet. Spec: search returns empty results; dropdown shows "No accessible people match..." (distinct from "no results in the database").
- **EC-7 — Network error mid-query**: dropdown shows a retry message ("Couldn't search — tap to retry"). Debounce resets on retry.
- **EC-8 — User searches for themselves**: not special-cased. If they have access to their own role's listing (e.g. faculty can see themselves), their own name appears normally.
- **EC-9 — Department/programme missing**: some legacy records may not have a department/programme set. Spec: show "—" for the department field; don't omit the row.
- **EC-10 — Soft-deleted people**: the existing Person model has no soft-delete, but Student/Faculty/Staff have a `status` field. Spec: by default, search returns only `status: 'active'` rows. Include an advanced filter on the full results page (`/search?q=foo&includeInactive=true`).

## 7. Dependencies

### Internal (existing code)
- **Models**: `backend/src/models/people/{Person,Student,Faculty,Staff,Parent,Alumni}.ts`
- **RBAC**: `backend/src/shared/rbac/apply-scope.ts` (already provides `applyAuthScope`), `authorize` middleware
- **Existing list-page services in `backend/src/modules/people/service.ts`** — the scoping logic there is the reference for how to scope search results
- **Admin-portal layout**: `admin-portal/src/layouts/DashboardLayout.tsx` (top nav lives here)
- **React Query v5**, Axios client (already in use)

### New infrastructure needed
- One new backend endpoint: `GET /api/people/search?q=<query>`
- One new full-results page: `/search?q=<query>`
- One shared frontend search component (header input + overlay modal, sharing the same internal state)

### External
- **None**. No new npm dependencies needed.

## 8. Success Metrics

Measurable post-launch:

- **M-1**: Search endpoint p95 latency < 300ms at a college with ≥ 5,000 people (tracked via existing morgan logs + a lightweight timing middleware for this endpoint)
- **M-2**: Adoption — within 30 days of rollout, ≥ 50% of active admin-portal users have used global search at least once in a 7-day window (measured via frontend analytics if available; otherwise by counting unique-user hits to `/api/people/search` via logs)
- **M-3**: Time-to-find-a-person reduction — before rollout, average time from "I want to find X" to arriving at X's detail page = baseline (self-reported survey of 5 admin users). After rollout, the same survey should show ≥ 50% reduction
- **M-4**: Zero security regressions — no log entry shows a user seeing a person they shouldn't have been able to see. Validated by the RBAC scope tests (see Plan §4).
- **M-5**: No increase in 5xx error rate on the `/api/people/*` surface after rollout

## 9. Open Questions (none blocking; resolve during planning if possible)

- **OQ-1**: Does Faculty have an `employeeId` field? Staff has one (per sample staff factory). Need to confirm in planning.
- **OQ-2**: What does a Parent's "primary identifier" look like in the search result row? Candidate: linked student's name + roll number ("Parent of Arjun Reddy · 22JIT0007")
- **OQ-3**: Is the full-results page (`/search?q=...`) a new top-level route or does it live under an existing nav item? Suggested: new top-level route; added to `App.tsx` routes
- **OQ-4**: Do alumni have a `departmentId` on their record, or does it come from the old Student record? Need to verify
- **OQ-5**: Search in the header — what width/visual treatment in narrow viewports (tablet landscape, ~1024px)? Might collapse to an icon-only search button. Flag for design pass.

## 10. Changelog

- **2026-04-18** — Initial spec drafted through 5-question interview.
