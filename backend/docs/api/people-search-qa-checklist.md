# Global People Search — QA & Deploy Checklist

**Feature:** global-people-search
**Owners:** backend (search-service, routes, rate limit); frontend (overlay, /search page)
**Related docs:** `./people-search.md` (API reference), `.captain/specs/global-people-search/`

Use this when shipping to QA / staging / prod. Walk through each section
in order; check a box only after the step passes in the target environment.

---

## 1. Backend deploy — pre-flight

- [ ] `npm run typecheck` passes (root).
- [ ] `npm test -w backend` passes — 262/262 unit tests including the 36 new for this feature.
- [ ] `npm run test:e2e people-search -w backend` passes — 12/12 HTTP-contract tests.
- [ ] Env vars unchanged — this feature adds no new env surface.
- [ ] `Person` collection indexes applied:
  - [ ] `{ collegeId: 1, name: 1 }` exists (run `db.people.getIndexes()` in a mongo shell to verify).
  - [ ] `{ collegeId: 1, email: 1 }` exists.
  - Mongoose `syncIndexes()` creates these on boot if they're missing. If the target DB is large, pre-create them manually in a maintenance window:
    ```js
    db.people.createIndex({ collegeId: 1, name: 1 }, { background: true });
    db.people.createIndex({ collegeId: 1, email: 1 }, { background: true });
    ```
- [ ] Rate-limit store is in-memory (default `express-rate-limit` store). If the backend runs multi-replica in prod, rate-limit buckets are per-instance — acceptable for this v1 but note for an SRE follow-up to move to a Redis store.

---

## 2. Frontend deploy — pre-flight

- [ ] `npx tsc --noEmit` passes in `admin-portal/`.
- [ ] `npm run build -w admin-portal` produces a fresh bundle.
- [ ] `SearchResults` chunk is lazy-loaded (should only download on `/search` navigation, confirmed via Network tab).
- [ ] `GlobalSearch` renders in the header of every authenticated page.
- [ ] First-time tooltip storage key (`gps:hint-seen`) is not used by any other feature.

---

## 3. Smoke tests per role

Spin up a token for each role and run the three-query smoke test below.
Record results in the deployment ticket.

**Common queries:**
1. `ramesh` (common first name)
2. `22JIT0001` (roll-number exact match — use whatever roll format your target college uses)
3. `9998887777` (phone, 10 digits)

| Role                 | Query 1 expected          | Query 2 expected                  | Query 3 expected            | Scope check (additional)                                      |
|----------------------|----------------------------|-----------------------------------|------------------------------|---------------------------------------------------------------|
| `super_admin` (multi-college) | All colleges' matches  | All colleges' matches             | All colleges' matches        | Results cross college boundaries                              |
| `admin` / `principal` | All in current college    | Same                              | Same                         | Receives non-active rows if `includeInactive=true`            |
| `hod` (CSE)          | CSE matches only          | CSE match only                    | CSE matches only             | Other-dept students absent from results                       |
| `faculty` (persona-scoped) | Self-linked records only | Self-linked records only     | Self-linked records only     | Does NOT see peers' personal data                             |
| `ST-WARDEN`          | Hostel-relevant students only (if persona-scoped) | Same | Same | Scope enforcement preserved                                |

- [ ] Each role's results match the expected scope above.
- [ ] No result contains `phone`, `email`, `dob`, `aadhaar`, or `address` — open DevTools → Network → Response body and visually confirm. (E2E test covers this automatically; this is a belt-and-suspenders manual check for prod data shapes.)

---

## 4. Keyboard & UX flows

- [ ] `⌘K` (macOS) and `Ctrl+K` (Win/Linux) open the overlay from any page under `DashboardLayout`.
- [ ] Overlay auto-focuses the input.
- [ ] Typing shows placeholder states correctly:
  - 0–1 chars → "Type at least 2 characters"
  - 2+ chars, no match → "No people match '<q>'."
  - Network error → "Couldn't search" with retry.
- [ ] Arrow Up / Down cycles selection; wraps at top/bottom.
- [ ] Enter navigates to the correct role-specific route (see `routeForResult`).
- [ ] Esc closes; backdrop click closes.
- [ ] Tab cycles focus within the overlay (focus-trap).
- [ ] Body scroll is locked while the overlay is open; restored on close.
- [ ] "See all N results" link on a `hasMore` result navigates to `/search?q=<q>`.
- [ ] `/search` page:
  - [ ] Respects `?q` and `?includeInactive` URL params — deep-linkable.
  - [ ] Admin sees the "Include inactive" checkbox; non-admin does not.
  - [ ] Clicking a row navigates to the correct list page with `?highlight=<id>`.
  - [ ] Breadcrumb reads `Dashboard › Search › "<query>"`.

---

## 5. Rate-limit behaviour

- [ ] Spam 70+ requests within 60 seconds as one user — verify 429 returned after the 60th.
- [ ] 429 body is `{ "error": "rate_limited", "retryAfter": <number> }`.
- [ ] A second authenticated user can still search normally during the first user's rate-window.
- [ ] Unauthenticated requests hit 401 (no leak of `/search` endpoint existence via rate-limit alone).

---

## 6. Observability (first week of prod)

- [ ] Add dashboards / logs for:
  - p50 / p95 / p99 latency of `GET /api/people/search`.
  - 429 rate (user-rate-limit saturation) — should be near zero. Spikes mean a client bug.
  - 5xx rate — any non-zero rate warrants investigation.
- [ ] SLO target: p95 < 500ms on a 5000-person college.
- [ ] Alert threshold: p95 > 1000ms for 10 minutes → page the on-call.

---

## 7. Known limitations (documented, deferred)

- **Per-person detail pages don't exist** for every role. Search row clicks
  navigate to the role's list page with `?highlight=<personId>` — the list
  pages must consume `highlight` to visually mark the row. Until they do,
  users land on the correct list but without the highlight. (Follow-up
  ticket: implement `?highlight` in the existing People list pages.)
- **Inline header-typing mode** from spec §5.1 is deferred; clicking the
  header pill opens the full overlay on all viewport sizes. Cmd+K gives
  the same fast path.
- **Frontend tests** are not written — admin-portal workspace has no test
  runner. Tracked as a separate "stand up vitest for admin-portal" task.
  Backend e2e coverage (T4) validates the HTTP contract end-to-end.
- **Rate-limit store is per-instance** (in-memory). In a multi-replica
  deployment a user could technically get `60 × N-instances` requests before
  hitting the limit. Acceptable for v1 — tracked as SRE follow-up to move
  to a Redis store.
