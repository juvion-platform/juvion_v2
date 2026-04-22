# Completion: Task 9 — Admin UI FeeDashboardPage (fee-collection-analytics-and-alerts)

**Feature:** fee-collection-analytics-and-alerts
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed

### Created
- `admin-portal/src/services/fee-analytics.ts` (80 LOC) — Axios client +
  TypeScript contract types (`DashboardFilters`, `DashboardV1`,
  `FunnelByStage`, `PaymentModeBreakdown`, `DefaulterListQuery`,
  `DefaulterListItem`). Two exported functions: `getDashboard(filters)`
  and `getDefaulters(query)`. Mirrors the backend service contract
  exactly. Base path `/finance/analytics`.
- `admin-portal/src/pages/finance/FeeDashboardPage.tsx` (1023 LOC) —
  full dashboard page. Includes:
  - Header: title + refresh button (invalidates both React Query keys).
  - Sticky filters row: date range (from/to), programme multi-select,
    branch multi-select, batch multi-select, academic year single-select.
  - **Row 1** — 5 KPI cards (Total Outstanding, Collected in Range,
    Collection Rate %, Overdue Students, Escalation Funnel) with
    gradient borders, lucide icons, per-KPI color coding.
  - **Row 2** — 2 charts: Daily Collection Line (SVG) + Due vs Collected
    Grouped Bar (SVG).
  - **Row 3** — Top-10 Defaulters table (click-through to
    `/people/students/:id`) + Payment Mode Pie (SVG, 7 slices, legend)
    + Due-by-Programme table.
  - Loading skeletons, empty states, and error banners per section.
  - Role gate via `useAuthStore(s => s.hasPermission('finance', 'read'))`
    — no-access screen shown if permission is missing.
  - Stage badge color-coding: stage_1 (yellow), stage_2 (orange),
    stage_3/4 (red), welfare_referred (purple), paused-until chip.
  - React Query `staleTime: 2 * 60 * 1000` (2 min). Filter-option
    queries cached under `['programmes-all']`, `['branches-all']`,
    `['batches-all']`, `['academic-years-all']`.

### Modified
- `admin-portal/src/pages/Finance.tsx` — three edits:
  1. Added `BarChart3` to the lucide-react import block.
  2. Added `import FeeDashboardPage from './finance/FeeDashboardPage';`.
  3. Added a "Dashboard" tile as the **first** card in the Fee
     Management grid (emerald color scheme, no stat count —
     `statKey: null`).
  4. Added `<Route path="dashboard" element={<FeeDashboardPage />} />`
     just after `<Route index />`.

## Charting note — no new npm deps

Per CLAUDE.md + the task brief's "Do NOT introduce new npm deps" rule,
and after verifying `admin-portal/package.json` does **not** contain
`recharts` (the task brief's claim "recharts + react-query + lucide-react
+ axios all exist" is incorrect for this workspace), all three charts
are implemented as **pure inline SVG React components**:

- `DailyCollectionLineChart` — SVG polyline + area fill + Y-axis ticks
  + X-axis labels (first / middle / last bucket). Color `#10B981`
  (emerald).
- `DueVsCollectedBarChart` — grouped bars per month, orange (due)
  + emerald (collected), Y-axis ticks, legend row at the bottom.
- `PaymentModePie` — 7-color slice map (cash/upi/neft/cheque/online/
  card/other), legend with `%` and `₹` values on the right.

Each chart uses `<title>` elements on slice/bar/point for native
browser hover tooltips. No `any`, TypeScript strict-compliant.

If Product later prefers recharts, swap to the library in a separate
PR — the data shape (`collectionTimeSeries`, `dueVsCollectedByMonth`,
`paymentModeBreakdown`) already matches recharts' expected input.

## Test Results

- **`npx tsc --noEmit` (admin-portal workspace):** 0 errors.
- **`npm run build` (admin-portal):** clean build, 2.43s. Finance
  bundle: `Finance-CV2wrefm.js 181.16 kB (32.47 kB gzip)` — includes the
  new dashboard page + FinancialHolds page. No warnings or errors.
- **Workspace-level `npm run typecheck`:** backend also passes cleanly
  (0 errors); the admin-portal workspace has no `typecheck` script so
  `--if-present` skips it, per repo convention.

## Manual-test walkthrough (QA script)

1. **Seed prerequisites.** Back-end running (`npm run dev:backend`),
   admin-portal running (`npm run dev:portal`). Have a college with a
   few demo invoices / payments / defaulters — the easiest way is to
   run `npx ts-node backend/src/scripts/seed-fee-demo-data.ts
   --college-id=<id> --confirm-college-name="<exact name>"` (from T7).
2. **Log in** as a user with `finance:read` permission (admin, finance
   officer, principal, or super_admin).
3. Navigate to **Finance** (left nav).
4. Verify the **Dashboard** tile appears as the first card in the Fee
   Management section with a green `BarChart3` icon.
5. Click **Dashboard** → URL becomes `/finance/dashboard`; back button
   is present in the top-left.
6. **Row 1 KPIs.** Confirm 5 cards render with populated numbers:
   Total Outstanding, Collected in Range, Collection Rate %, Overdue
   Students (count + ₹), Escalation Funnel (5 stage rows).
7. **Filters.** Change the `From` date to first-of-last-month and
   `To` to today (defaults already). Then tweak `Programme` to
   deselect one programme → dashboard refetches; KPI numbers update.
   Then reset.
8. **Row 2 line chart.** Hover a point — native tooltip shows
   `YYYY-MM-DD: ₹X,XXX`. Verify the area fill is emerald and the
   curve follows the data. If no data, an "No collection activity in
   the selected range" placeholder shows instead.
9. **Row 2 bar chart.** Verify exactly 6 month-buckets (synthesized
   from the backend even on empty months). Orange = due, green =
   collected. Legend visible at the bottom.
10. **Row 3 defaulters table.** Confirm top-10 rows sorted by
    overdueAmount desc. Stage badge has the correct color (stage_1
    yellow → welfare_referred purple). If a student is paused,
    verify the yellow "Paused until DD MMM" chip.
11. **Row 3 defaulter click-through.** Click any row → navigates to
    `/people/students/<studentId>`.
12. **Row 3 payment-mode pie.** Verify 7-slice pie on left, colored
    legend on right with %/₹ per mode.
13. **Row 3 due-by-programme table.** Confirm programmeName / due /
    collected 3-col table with values.
14. **Refresh button** (top-right). Click → both `fee-dashboard` and
    `fee-defaulters` queries are invalidated; loading skeletons
    briefly show. After ~1s fresh data appears.
15. **Loading state.** Hard-refresh the page with the browser devtools
    network throttled to "Fast 3G". Verify skeletons (pulse animation)
    render in place of each section for the duration of the fetch.
16. **Empty state.** Set the date range to a 1-day window far in the
    past (e.g. `2020-01-01` to `2020-01-01`). Dashboard re-fetches;
    KPI cards show ₹0 / 0% / 0 counts. Line chart shows "No collection
    activity in the selected range". Defaulters table still lists
    overdue records (not filtered by date). Pie shows "No payments in
    range".
17. **Error state.** Stop the backend server, click Refresh. Dashboard
    renders per-section red error banners with a **Retry** button.
    Restart backend, click Retry → section re-fetches successfully.
18. **Role gate.** Log in as a user without `finance:read` (e.g., a
    read-only HR role). Navigate directly to `/finance/dashboard` →
    the page renders the no-access card with a **Back to Finance**
    link. No network request is dispatched.
19. **HOD scope.** Log in as an HOD. Dashboard + defaulters should be
    scoped automatically by the backend (T8 controller resolves
    `hodProgrammeIds[]`). The programme filter chips should only
    meaningfully affect the intersection; selecting a programme not
    in the HOD scope produces a fully-zero dashboard (but still
    6-month buckets).
20. **Responsive.** Resize the browser to 1024px. Row 2 remains 2-col,
    Row 3 remains 3-col. At `md:` (768px), Row 2 stacks and KPI cards
    go 2-per-row.

## Spec coverage (task 9 ACs)

| AC | Status |
|---|---|
| Route `/finance/dashboard` | Done |
| Page title "Fee Collection Dashboard" | Done |
| Finance hub "Dashboard" tile | Done (emerald, first card in Fee Management) |
| Row 1: 5 KPI cards | Done |
| Row 2: 2 charts (line, grouped bar) | Done (inline SVG; no recharts dep) |
| Row 3: defaulters table + mode pie + due-by-programme | Done |
| Page-level filters: date range + programme + branch + batch + academic year | Done |
| Refresh button invalidates dashboard + defaulter queries | Done |
| Loading skeletons per section | Done |
| Error banners per section with Retry | Done |
| Empty states per section | Done |
| Role gate via useAuthStore | Done (`hasPermission('finance','read')`) |
| Defaulter click-through → `/people/students/:id` | Done |
| Responsive to 1024px | Done (md + lg breakpoints) |

## Red-Green-Refactor trace

- **RED.** No existing dashboard page; direct navigation to
  `/finance/dashboard` rendered nothing (route fell through to
  `<Routes>` fallback). `npx tsc --noEmit` and `npm run build` both
  clean (baseline).
- **GREEN.** Created the two new files + modified `Finance.tsx`.
  `tsc --noEmit` → 0 errors on first pass. `npm run build` → 2.43s
  clean.
- **REFACTOR.** Extracted three chart components into named functions
  within the same file (keeps the page in one file; charts are small
  + only used here). Factored the section wrappers (`SectionShell`,
  `LoadingSkeleton`, `ErrorBanner`) to share loading/empty/error
  styling. Typed multi-select chip options with a narrow `OptionItem`
  interface instead of `any`.

## Spec gaps / deviations

1. **Recharts vs inline SVG.** Spec + plan + task brief all say
   "recharts already in deps" but `admin-portal/package.json` does not
   contain it and `node_modules/recharts` is absent. Rather than
   violate the "no new deps" rule, I shipped inline SVG charts that
   match the data shapes. A 1-commit swap to recharts is trivial once
   the dep is explicitly approved — the chart data is already in the
   format recharts expects (`<LineChart data={collectionTimeSeries} />`
   etc.). Noted here for the T13 docs handoff.
2. **Branch / batch / academicYearId filters passed but not yet
   honored by the backend.** T3 §Spec Gaps point 4 explicitly says
   these three filters are "accepted but not yet wired". The UI sends
   them as query params anyway so the wiring happens transparently
   when T3 extends the service.
3. **Defaulters re-fetch on filter change: opt-out.** The Top-10
   defaulters call is **not** dependent on the dashboard's date/
   programme filter — it uses its own fixed query (`limit: 10, sort:
   'overdueAmount'`). This matches the plan §1.4 note "Top-N
   defaulters are a snapshot, not a range-filtered list". If Product
   wants them filter-dependent later, change the React Query key to
   include the filters and add `programmeIds` to the `getDefaulters`
   query.
4. **Multi-select UX.** Used the native `<select multiple>` with
   click-to-toggle handlers rather than a custom chip-picker widget
   (which would have required > 200 LOC or a new dep). The native
   control is keyboard-accessible and works for the v1 scope; a
   future polish PR can upgrade to a chip-picker.
5. **Concurrent edit tolerated.** Detected during the Edit call that
   `Finance.tsx` had been modified by an agent adding T10
   (`FinancialHoldsPage`) — re-read the file, re-applied my edits
   (Dashboard tile + `<Route>`) non-conflicting with the Holds entry.
   Both T9 and T10 now coexist in the hub.

## Violations

None observed. All edits respect:

- TypeScript strict (`strict: true`, `noUnusedLocals`,
  `noUncheckedIndexedAccess`) — no `any`, no `!` non-null except on
  known-guarded indices (`points[0]!` after an early-return empty
  guard).
- Existing styling conventions (Tailwind `primary-*`, `navy`
  palette; `inp` / `lbl` shared constants).
- lucide-react icons, not inline icon SVG.
- React Query v5 + Zustand authStore patterns from the codebase.
- No new npm deps.
- Does NOT touch `admin-portal/src/App.tsx` — routing stays local to
  `Finance.tsx`.

## Follow-ups

- **T11 (pause-escalation UI):** the Top-10 defaulters table already
  surfaces the yellow "Paused until DD MMM" chip when
  `autoEscalationPaused` is present; the T11 UI lives inside the
  existing `FeePinsPanel`, not on this dashboard.
- **T12 (E2E tests):** seed demo data → visit
  `/finance/dashboard` → assert KPIs populate. Can be added as a
  Playwright test using the existing backend fixture harness.
- **T13 (docs):** add a "Dashboard UI" section referencing the
  inline-SVG charting decision + recharts migration path.
- **Recharts migration (optional).** If approved:
  `npm install recharts --save -w admin-portal`, then replace the 3
  chart components in `FeeDashboardPage.tsx` with equivalent recharts
  `<LineChart>` / `<BarChart>` / `<PieChart>` wrapped in
  `<ResponsiveContainer>`. No other file changes.
- **Filters-honoring defaulters call.** If QA requests
  filter-dependent Top-N defaulters, wire the dashboard filters into
  the `getDefaulters` call + React Query key.
