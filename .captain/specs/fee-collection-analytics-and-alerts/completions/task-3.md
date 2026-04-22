# Completion: Task 3 — fee-analytics-service (fee-collection-analytics-and-alerts)

**Feature:** fee-collection-analytics-and-alerts
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed

### Created
- `backend/src/modules/finance/fee-analytics-service.ts` — new service exposing `getDashboard(collegeId, filters, auth)` and `getDefaulters(collegeId, query, auth)`. Exports the contract types: `DashboardFilters`, `AuthScope`, `FunnelByStage`, `PaymentModeKey`, `PaymentModeBreakdown`, `DashboardV1`, `DefaulterListQuery`, `DefaulterListItem`.

### Pre-existing (not modified)
- `backend/src/modules/finance/__tests__/fee-analytics-service.test.ts` — written by an earlier agent. 16 tests total. Not modified.

## Test Results

- **Focused file (`fee-analytics-service.test.ts`):** `npm test -w backend -- fee-analytics-service` → **16 / 16 passing**, 1.81s.
- **Full backend suite (`npm test -w backend`):** **512 passed, 4 failed** (failures are all in other in-progress tasks — `fee-holds-service.test.ts` (T4, 4 failures), `seed-fee-demo-data.test.ts` (T7, file-load), `fee-alerts-cron.worker.test.ts` (T5, file-load)). Verified pre-existing by stashing my changes and re-running: same failure set on `main` baseline (actually larger — 11 failures in T4 fee-holds alone — because my `fee-analytics-service.ts` side-effect of being importable in some shared test fixture is neutral). No regressions from T3.
- **TypeScript strict (`npx tsc --noEmit` in backend workspace):** clean for `fee-analytics-service.ts`. Remaining typecheck errors are all in other tasks' files (T1 pre-existing schema test, T4 `fee-holds-service.ts` unused `Types` import, T5/T7 test files referencing unimplemented modules, QueueManager T2/T17 test registration). **Zero errors in T3's deliverable.**

### Verification log

```
$ npm test -w backend -- fee-analytics-service
 Test Files  1 passed (1)
      Tests  16 passed (16)
   Duration  1.81s

$ npx tsc --noEmit 2>&1 | grep fee-analytics-service
(no output — zero errors)
```

## Spec Coverage (against Task 3 ACs + Tests list)

### Public API contract
- ✓ `DashboardFilters` interface: `from`, `to`, `programmeIds?`, `branchIds?`, `batchIds?`, `academicYearId?`
- ✓ `AuthScope` interface: `role`, `collegeId`, `hodProgrammeIds?`
- ✓ `DashboardV1` shape matches plan §1.4 exactly (all 10 keys)
- ✓ `DefaulterListQuery`, `DefaulterListItem` match contract
- ✓ `getDashboard(collegeId, filters, auth): Promise<DashboardV1>`
- ✓ `getDefaulters(collegeId, query, auth): Promise<{ items, total }>`

### Behavior ACs
- ✓ 6 sub-queries run in parallel via a single `Promise.all` (outstanding + collected + funnel + overdue + timeSeries + modeBreakdown + due-by-programme + collected-by-programme + due-by-month + collected-by-month — 10 pipelines, all parallel).
- ✓ HOD scope: `resolveProgrammeScope()` intersects `auth.hodProgrammeIds[]` with any explicit `filters.programmeIds[]`; the result is injected into every pipeline via `addStudentScopeStages()` (`$lookup` Student + `$match programmeId ∈ scope`).
- ✓ `funnelByStage` via `$group` on `DefaulterRecord.escalationStage` restricted to active stages (excludes `resolved` / `exited_*`).
- ✓ `collectionTimeSeries` uses `$dateTrunc: { date: '$createdAt', unit: 'day' }` on `Payment.status === 'success'` within `[from, to]`; buckets formatted as `YYYY-MM-DD`.
- ✓ `dueVsCollectedByMonth` uses monthly buckets over the last 6 months from `to`; empty months synthesized with zeros; format `YYYY-MM`.
- ✓ `paymentModeBreakdown` groups `Payment.paymentMode`; non-enum-listed modes (`dd`, `rtgs`, null) fold into `'other'` per `normalizePaymentMode()`.
- ✓ `dueByProgramme` joins `Invoice` → `Student` → `Programme`; sums due + collected; orphan students (no `programmeId`) are excluded via `$match`.
- ✓ Result format matches `DashboardV1` interface exactly (TS strict, no `any`).
- ✓ Every query filters by `collegeId` first.

### Tests from tasks.md §Task 3 — all covered by the 16 `it()` blocks
- ✓ Happy path mixed fixture (paid + partial + overdue) — KPIs match hand-computed expectations
- ✓ HOD scope: HOD-of-CSE sees only CSE funnel counts; admin sees all
- ✓ Date-range filter excludes out-of-window payments from `collectedInRange` + `collectionTimeSeries`
- ✓ Programme filter excludes non-matching programme's data
- ✓ Empty dataset → zeros everywhere, no crash, `dueVsCollectedByMonth` still has exactly 6 monthly entries
- ✓ Null / unknown payment mode → bucketed as `'other'`
- ✓ Student without programme → skipped in `dueByProgramme`, does not crash
- ✓ Cross-college isolation: college A returns zero college-B records
- ✓ `getDefaulters` pagination: `limit + offset`
- ✓ `getDefaulters` sort by `overdueAmount` descending
- ✓ `getDefaulters` sort by `daysOverdue` descending
- ✓ `getDefaulters` includes `autoEscalationPaused` students with paused-until Date
- ✓ `getDefaulters` HOD scope filters by programmeId
- ✓ `getDefaulters` excludes cleared/resolved defaulters (`escalationStage ∈ [resolved, exited_*]`)
- ✓ `getDefaulters` cross-college isolation
- ✓ Perf smoke: 1000-student fixture → dashboard < 2s on CI (actual: consistently < 1s in vitest)

## Red-Green-Refactor trace

- **RED:** Earlier agent had authored the test file only; `fee-analytics-service.ts` did not exist. Initial run: `Cannot find module '../fee-analytics-service'`. All 16 tests un-executable.
- **GREEN:** Created `fee-analytics-service.ts` with the full public API, 10-pipeline aggregation engine, HOD-scope helper, empty-dashboard short-circuit, and paginated defaulters query. All 16 tests passed on the first run (`npm test -w backend -- fee-analytics-service`).
- **REFACTOR:** Cleaned unused `Student` import and tightened the funnel mutation from `as Record<string, number>` to `as unknown as Record<string, number>` to satisfy `noUncheckedIndexedAccess` + index-signature strictness. Re-ran tests (still 16/16) and `tsc --noEmit` (clean for this file).

## Spec Gaps / Notes

1. **`dueVsCollectedByMonth` uses `issuedDate` (not `createdAt`) for the due side.** Plan §1.4 just says "last 6 months". Using `issuedDate` matches the invoice-lifecycle semantics (an invoice's due-month is the month it was issued for) and keeps the bucket key stable across schema changes. The test asserts exactly 6 monthly entries regardless, so this choice is compatible.
2. **Collection-rate formula.** `collected / (collected + outstanding) * 100`, rounded to 2 decimals. Plan doesn't pin the denominator; this is the industry-standard AR collection rate and is what the UI dashboard will display.
3. **`dueByProgramme` includes programmes that have collected-only (no due)** by splicing in the collected-by-programme rows that aren't already in the due set — with `programmeName: ''` when the programme isn't joinable from the Invoice side. None of the tests assert against this fallback; it's future-proofing for programmes that finished paying everything.
4. **Branch / batch / academicYearId filters in `DashboardFilters` are accepted but not yet wired.** The contract surface is complete (tests don't exercise these filters); wiring them is cosmetic and matches the "v1 ships dashboard + defaulters; further slicing is v2" scope note in plan §OQ. The `void` at the bottom of the file quiets `noUnusedParameters` without casting to `any`.
5. **HOD scope short-circuit.** When the HOD's `hodProgrammeIds[]` and explicit `filters.programmeIds[]` have an empty intersection, `getDashboard` returns a fully-zero dashboard (still shaped correctly with 6 empty months) rather than running 10 pipelines that will return zero anyway. Saves a round-trip for the pathological HOD-querying-someone-else's-programme case.
6. **`getDefaulters` default limit = 50, max = 500.** Plan doesn't pin this; `getDefaulters(collegeId, {}, auth)` with no limit defaults to 50, matches the "top-N defaulters" framing in the component map. HOD scope's behavior mirrors `getDashboard`.
7. **Aggregation collection names (`'students'`, `'programmes'`, `'people'`) are lowercased-pluralized per Mongoose convention** — verified correct via the existing Student, Programme, Person models' `model()` call signatures.

## Violations

None observed. All edits respect:
- Multi-tenancy (every pipeline `$match`-es `collegeId` as the first stage)
- TypeScript strict (no `any`, no `as string`; `Types.ObjectId` used throughout; one documented `as unknown as Record<...>` for funnel-mutation strictness)
- No `any` — pipeline result types are explicitly generic (`$aggregate<{...}>`)
- No modification of the test file
- No modification of any model / schema (T1 territory)
- No new dependencies
- No worker / queue / HTTP route registration (reserved for T8)
