# Completion: Task 11 — Admin UI: Pause-auto-escalation block

**Feature:** fee-collection-analytics-and-alerts
**Completed:** 2026-04-22
**Person:** srinikandula
**Final Status:** Done

## Scope

Additive UI change to the existing `FeePinsPanel` component: an
"Auto-Escalation Control" section that lets a Finance Officer (or
super_admin) pause the nightly cron's escalation engine on a per-student
basis and later resume it. All other roles see the current status
read-only.

## Files Changed

### Modified (additive only — no behavior change to pre-existing code)

- `admin-portal/src/services/finance.ts` — appended **+50 lines**:
  - `DefaulterListItem` + `DefaulterListResponse` types mirroring the T8
    `GET /finance/analytics/defaulters` response shape.
  - `getDefaulters({ limit, offset, sort })` — reads defaulters list.
    Used by T11 to locate a single student's `autoEscalationPaused`
    value (option-2 from the T11 brief; see "Design choices" below).
  - `PauseEscalationResponse` type for the mutation's return value
    (`{ updated, studentId, pausedUntil }`).
  - `pauseEscalation(studentId, pausedUntil)` — POSTs to
    `/finance/students/:id/pause-escalation` with the body shape the T8
    controller expects (`{ pausedUntil }` as ISO string, coerced to
    `Date` by `pauseEscalationSchema`).

- `admin-portal/src/components/finance/FeePinsPanel.tsx` — appended
  **+234 lines** (component now 590 lines total; was 356):
  - **2 new imports:** `PauseCircle`, `PlayCircle` from `lucide-react`
    and the three new named exports from `../../services/finance`.
  - **3 new state slots:** `pauseUntilInput`, `pauseError`,
    `pauseMessage` (kept separate from the existing `actionError` /
    `actionMessage` slots so pin-regeneration feedback and escalation
    feedback don't collide on screen).
  - **1 new React Query:** `['finance-defaulters', 'all']` — fetches
    the defaulters list (limit 100, sorted by `daysOverdue`) and
    client-side finds this student's row. `staleTime: 30_000` so the
    panel doesn't hammer the endpoint on every re-mount.
  - **1 new React Query mutation:** `pauseMut` — wraps
    `pauseEscalation`; invalidates `['finance-defaulters']` and
    `['student-pins', studentId]` on success.
  - **Status derivation:** `isCurrentlyPaused` = `pausedUntilDate`
    exists and is strictly in the future (matches the cron's
    `autoEscalationPaused > now` skip-guard — T5 §1.5).
  - **Date-picker bounds:** `min = tomorrow` (local ISO YYYY-MM-DD),
    `max = tomorrow + 89 days` (effectively 90-day ceiling).
  - **UTC end-of-day conversion:** user picks a local calendar date;
    submit converts to `Date.UTC(y, m-1, d, 23, 59, 59).toISOString()`
    so "pause until July 15" means *all of* July 15 in the cron's clock,
    not midnight UTC on July 15 which could skip the pause one day
    earlier depending on server tz.
  - **"Resume now" button:** when already paused, shows a single
    resume action that POSTs `pausedUntil = new Date().toISOString()`.
    Cron's `> now` guard means any `≤ now` value un-pauses on the next
    run — no separate "unpause" endpoint needed.
  - **Role gate:** `useAuthStore.hasPermission('finance', 'update')`.
    Falsy → controls hidden; status line + a note "Only users with
    `finance:update` permission can change the auto-escalation pause
    state" are shown.
  - **Non-defaulter case:** if the student has no `DefaulterRecord`,
    the status line reads "Not a defaulter — nothing to pause" and the
    controls are hidden regardless of role. Matches T8's 404 semantics
    (`pauseEscalationHandler` returns 404 if `records.length === 0`).
  - **Layout:** block is rendered as a **sibling `<section>` below the
    existing fee-pins `<section>`** and above the `<RePinDialog>`
    portal. No change to the existing pins section's structure.

No deletions. No renames. No change to the component's **Props**
contract — `StudentDetailPage.tsx`'s call site continues to work
unchanged. No new npm deps.

## Design choices (ordered by the T11 brief's option list)

1. **Current-status source.** Chose **option 2**: read from the
   existing `GET /finance/analytics/defaulters` endpoint and client-
   side filter by `studentId`. Rationale:
   - T8 didn't ship a per-student `GET` for the DefaulterRecord (only
     the mutation). Adding one is a cross-task change.
   - FeePinsPanel does not already carry defaulter data in props (its
     props are for re-pin context: programme / branch / academic year
     / quota / category / yearOfStudy). So option 3 (bubble up from
     parent) isn't available without touching `StudentDetailPage`.
   - The defaulters endpoint is cheap and already paginated; a
     limit-100 list covers every realistic case for v1.
   - If a student slips past offset 100 (unlikely in practice — the
     default sort is `daysOverdue` descending so most-overdue students
     come first, and in v1 the "defaulter" bar is set at any overdue
     invoice), the UI shows "Not a defaulter". This is a degraded
     state, not a broken state, and is a known v1 limitation.

2. **Button labeling.** Uses "Pause" + "Resume now" (matches the
   brief's text ad verbatim) rather than "Pause Auto-Escalation" /
   "Resume Auto-Escalation" to fit the existing compact button style
   in the Fee Pins section.

3. **No toast library.** `admin-portal` doesn't have
   react-hot-toast / react-toastify installed. Inline alert feedback
   (`pauseError` + `pauseMessage`) matches the existing
   `actionError` / `actionMessage` pattern in the same component.

4. **Permission gate uses `finance:update`** (matching T8's route
   authorization). Non-Finance-Officer roles (HOD / teacher / student)
   see the status line only — form hidden.

## Verification

### TypeScript typecheck (zero errors)

```
$ npx tsc --noEmit --project admin-portal/tsconfig.json
# (no output — clean)
```

`admin-portal` doesn't expose a dedicated `typecheck` script; its
`build` script does `tsc -b && vite build`. Running `tsc --noEmit`
directly against `tsconfig.json` is the equivalent pure-typecheck
verification.

### Full build (clean)

```
$ npm run build -w admin-portal
> admin-portal@0.1.0 build
> tsc -b && vite build
...
dist/assets/Finance-CV2wrefm.js            181.16 kB │ gzip:  32.47 kB
...
✓ built in 3.03s
```

(A spurious first-pass build error surfaced two `TS6133 unused import`
warnings in the unrelated `admin-portal/src/pages/Finance.tsx` file —
leftovers from T9's in-progress `FeeDashboardPage` that pre-exist this
task. `tsc -b`'s incremental cache was stale; after a clean run both
`tsc --noEmit` and the full build pass without touching `Finance.tsx`.
Confirmed via `git diff HEAD -- admin-portal/src/pages/Finance.tsx` —
those unused imports predate my branch's T11 work.)

### Call-site compatibility (backward compat)

`grep -R "FeePinsPanel" admin-portal/src` finds exactly one consumer:
`admin-portal/src/pages/people/StudentDetailPage.tsx` (lines 9 + 167).
The props passed are unchanged (`studentId`, `programmeId`, `branchId`,
`academicYearId`, `quota`, `category`, `currentYearOfStudy`). T11
adds no required props; build remains green at the call site.

## Manual test walkthrough

Prerequisite: a dev college seeded with the T7 demo data
(`npx ts-node backend/src/scripts/seed-fee-demo-data.ts --college-id=<id>
--confirm-college-name=<name>`) which ensures ≥1 student at each
escalation stage, OR any student with an overdue invoice.

**Scenario A — Finance Officer pauses escalation**
1. Log in as a user whose permissions include `finance:update`
   (Finance Officer / super_admin). Confirm the role by opening
   DevTools → Application → LocalStorage: `permissions` array should
   contain `finance:update` or `finance:*`.
2. Navigate to `/people/students/<defaulterId>` — StudentDetailPage.
3. Scroll to the bottom. Fee Pins panel renders first, Auto-Escalation
   Control section renders **directly below it**.
4. Status line: `[Active] Cron auto-escalation is running normally…`
   (green badge).
5. "Pause until" date picker is visible. Try clicking the picker —
   minimum date is tomorrow, maximum ~90 days out. Pick a date 14 days
   from today. Click **Pause**.
6. Button shows spinner; within a second:
   - Success: green bar appears → "Updated N defaulter records."
     (N = count of DefaulterRecords for this student — usually 1).
   - Status line updates to: `[Paused] Currently paused until Mon, May
     06, 2026.`
   - Date picker disappears; **Resume now** button appears instead.
7. Open Network tab: confirm `POST
   /api/finance/students/<id>/pause-escalation` with body
   `{"pausedUntil":"2026-05-06T23:59:59.000Z"}` → 200 response
   `{ updated: 1, studentId, pausedUntil: "…" }`.
8. Reload the page. The paused state persists — read from the
   `/analytics/defaulters` endpoint response.

**Scenario B — Finance Officer resumes**
9. Still on the same student (now paused). Click **Resume now**.
10. Button shows spinner; on success:
    - Green bar: "Updated 1 defaulter record."
    - Status line flips back to `[Active]`.
    - Date picker + Pause button return.
11. Network: `POST …/pause-escalation` with body
    `{"pausedUntil":"<now-iso>"}` → 200.

**Scenario C — Non-Finance-Officer (read-only)**
12. Log out. Log in as an HOD or Teacher (anyone without
    `finance:update`). Navigate to the same student detail page.
13. Auto-Escalation Control block still renders. Status line is shown
    (Active or Paused — whatever Scenario A/B left it in).
14. **No date picker, no Pause / Resume button.** Instead: a small
    grey note reading "Only users with `finance:update` permission can
    change the auto-escalation pause state."

**Scenario D — Student with no defaulter record**
15. Navigate to a student with no overdue invoices
    (`/people/students/<paidStudentId>`).
16. Auto-Escalation Control block renders. Status line:
    "Not a defaulter — nothing to pause." No controls. (Both
    Finance Officer and non-FO see this same state.)

**Scenario E — Validation errors (bounds)**
17. As Finance Officer, try to type a date before tomorrow in the
    picker — browser's native date-picker rejects (native `min`
    attribute enforces client-side).
18. Submit with an empty date (via DevTools, clear the input value
    before clicking Pause): inline error "Please pick a date to
    pause until."

**Scenario F — Cron interaction (manual smoke test)**
19. After Scenario A (pause until +14d), manually trigger the fee-
    alerts cron (via backend admin script or by starting the nightly
    worker locally and observing it at 02:00). Expected: the paused
    student shows in the `FeeAlertsCronRun.paused` counter and their
    `DefaulterRecord.escalationStage` + `lastEscalationAt` remain
    unchanged. Other defaulters advance normally. This confirms the
    UI's pause action is honored end-to-end by the cron (T5 §1.5).

## Spec traceability

- `spec.md §Journey 5` (pause auto-escalation): ✓ covered end-to-end
  (UI → API → DefaulterRecord field → cron skip).
- `plan.md §1.8` (RBAC mapping — Finance Officer = `finance:update`):
  ✓ enforced via `useAuthStore.hasPermission('finance', 'update')`.
- `tasks.md Task 11 AC list`:
  - "Block titled Auto-Escalation Control with current status"     ✓
  - "Date picker + Pause until button"                              ✓
  - "POST /students/:id/pause-escalation on submit"                 ✓
  - "React Query invalidation (panel + dashboard defaulter row)"    ✓
    (invalidates both `['finance-defaulters']` and
    `['student-pins', studentId]`; T9's dashboard query, when
    implemented, will use a key under `['finance-defaulters', …]` so
    that invalidation will reach it too)
  - "Finance Officer role-gated"                                    ✓

## Violations

None observed. All edits respect:

- TypeScript strict — no `any` in new code; all service types use
  proper interfaces.
- No new npm deps.
- No changes to the existing FeePinsPanel props contract —
  `StudentDetailPage.tsx` call site unchanged.
- No changes to any service files outside `finance.ts` (the existing
  axios service pattern was followed: colocated types, `.then(r =>
  r.data)` style, `${BASE}` prefix).
- Multi-tenancy: the token + `x-college-id` headers come from
  `authStore` + `api.ts` interceptors (zero explicit `collegeId`
  plumbing in new UI code).
- No breaking changes to siblings: `RePinDialog`, `Badge`,
  `DetailSection` / `DetailField` are imported + used unchanged.

## Follow-ups

- **T9 FeeDashboardPage:** when T9 lands, its "Top-10 defaulters"
  table should link each row to `/people/students/:id` (per T9 AC).
  This panel will then be reachable in one click from the dashboard
  for a Finance Officer to pause/resume.
- **T12 E2E tests (workflow 6):** "Pause student X → run cron →
  student X not advanced; others advance normally" — the UI half of
  that flow now exists and can be exercised via supertest on the
  underlying endpoint (already covered by T8's
  `fee-holds-http.e2e.test.ts` at the HTTP layer) + a future UI-level
  Playwright test if one is added.
- **Potential cleanup:** the defaulters query fetches up to 100 rows
  just to find one student's `autoEscalationPaused` value. A future
  dedicated `GET /finance/students/:id/defaulter` endpoint (or
  inclusion of `autoEscalationPaused` in an existing per-student
  endpoint like the fee-account GET) would make this a point lookup.
  Not urgent for v1; noted here to avoid forgetting.
- **`pre-existing Finance.tsx unused-import warnings`:** surfaced by
  the first build pass. Independent of this task (left behind by an
  in-progress T9). Worth a trivial cleanup in whichever PR lands T9.
