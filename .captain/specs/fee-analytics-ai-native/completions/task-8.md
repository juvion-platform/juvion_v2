# Completion: Task A8 — Risk score integration on defaulter cards (fee-analytics-ai-native)

**Feature:** fee-analytics-ai-native
**Completed:** 2026-04-22
**Person:** srinikandula
**Final Status:** Refactored

## Files Changed

### Modified

- `admin-portal/src/services/finance-agent.ts` — appended A8 helpers below the A7 `getForecastNarrative` block:
  - `RiskScoreFactor` interface — `{ name, weight, value }` (mirror of the backend `RiskFactor` shape).
  - `RiskScoreResult` interface — `{ studentId, score: number | null, tier: 'low'|'medium'|'high'|'critical'|'insufficient-data', factors, narrative? }`. Matches the backend `service.ts` output type 1:1.
  - `getRiskScores(studentIds: string[], includeNarrative = false): Promise<RiskScoreResult[]>` — POSTs to `/juvi/finance-agent/risk-scores`. Default `includeNarrative=false` so callers don't accidentally trigger LLM batches.

- `admin-portal/src/pages/finance/FeeDashboardPage.tsx`:
  - **Imports:** added `getRiskScores`, `RiskScoreResult` from the agent service.
  - **`severityStyles` removed** — replaced with `riskTierStyles(score: number | null | undefined)` which maps the deterministic 0-100 score to wrap/amount/badge classes per the AC table (≥70 critical / ≥40 high / ≥15 medium / <15 low / null insufficient-data / undefined loading).
  - **`tierLabel(tier)`** helper — turns the backend `RiskTier` literal into a human-readable popover header label.
  - **`RiskHoverPopover`** new sub-component — anchors absolute-position above the badge, renders header (`Risk score: 82 / 100 (Critical)` / `\u2014 (Insufficient data)`), narrative paragraph (loading spinner / "Narrative unavailable" / text), and a factor-breakdown table (filters `weight !== 0`, sorted by `Math.abs(weight)` desc, color-codes positive vs. negative).
  - **`DefaulterCard` refactor** — now takes `riskScore?: RiskScoreResult` as a new optional prop; uses `riskTierStyles(riskScore?.score)`; replaces the day-counter badge with a risk badge (`Risk 82` / `Risk \u2014` / `Risk …`); attaches `onMouseEnter` (300ms intent timer) + `onMouseLeave` (cancel + close) to the badge wrapper. Hover state is local to the card (per-card `useQuery` for the lazy narrative — simpler than the parent-set approach the brief allowed). Card-row click still navigates via `onOpen(studentId)`; the popover is independent. Insufficient-data students do NOT trigger narrative fetch (`canFetchNarrative` requires `score !== null && hovered`).
  - **Parent `FeeDashboardPage`** — added `visibleStudentIds` memo + `riskScoresQuery` (key `['risk-scores', studentIdsKey]`, 2-min staleTime, `enabled` only when defaulters resolved). Built `riskScoresMap` for O(1) per-card lookup. New `sortBy` state with three options (`'risk' | 'amount' | 'days'`, default `'risk'`); `effectiveSort` falls back to `'amount'` while scores are loading per spec ("fall back to amount-sort visually until scores arrive"). New `sortedDefaulters` memo applies the effective sort with score-null items at the end and a stable secondary sort by `overdueAmount` for ties.
  - **Sort toggle UI** — three pill buttons above the defaulter list ("Sort by: Risk score | Overdue amount | Days overdue"), with `bg-blue-600 text-white` for active and `text-slate-600 hover:bg-slate-100` for inactive. Hidden when there are no defaulters at all.
  - **Loading pill** — small `<Loader2 /> Computing risk…` chip on the right of the sort row when `sortBy === 'risk' && riskScoresQuery.isLoading`.
  - **`refreshAll`** — also invalidates the `['risk-scores']` query key so the toolbar refresh button is wired through.
  - Risk list subtitle updated from "Ranked by overdue amount and days past due" → "Ranked by deterministic risk score (hover a badge for the AI breakdown)".

## Verification

```
$ npx tsc -b admin-portal 2>&1 | tail -10
(no output — 0 errors)

$ npm run build -w admin-portal 2>&1 | tail -10
dist/assets/Finance-kFPI7bhn.js            196.50 kB │ gzip:  36.80 kB
...
✓ built in 3.46s
```

- TypeScript strict (`tsc -b admin-portal`): **0 errors**.
- Vite production build: **clean** (3.46 s).
- No new npm dependencies.
- No backend touch.
- No lint / formatter complaints (Tailwind classes only, lucide-react icons reused).

## Spec Coverage (against Task A8 ACs)

| AC | How it's implemented |
|---|---|
| Batch-fetch `/risk-scores` for all visible defaulter ids on dashboard load | `useQuery({ queryKey: ['risk-scores', studentIdsKey], queryFn: () => getRiskScores(visibleStudentIds, false), enabled: defaulters.length > 0, staleTime: 2 * 60 * 1000 })`; `studentIdsKey = visibleStudentIds.join(',')` so the key changes iff the set changes. |
| Replace severity-tint logic with risk-score tiers (≥70 red, ≥40 amber, ≥15 slate, <15 muted, null neutral) | `riskTierStyles()` — switched from `severityStyles()` keyed on `daysOverdue` to score-based. |
| Sort by risk desc as the new default; toggle to amount or days | `sortBy` state defaults to `'risk'`; `sortedDefaulters` applies the active sort; toggle row above the list with three pill buttons. |
| Risk score badge replaces days-overdue badge | `Risk 82` / `Risk \u2014` (insufficient-data) / `Risk …` (still loading). |
| Hover badge → fetch narrative for ONE student (opt-in, lazy LLM) | `RiskHoverPopover` runs `useQuery({ queryKey: ['risk-narrative', studentId], queryFn: () => getRiskScores([studentId], true), enabled: fetchNarrative, staleTime: 10 * 60 * 1000 })`. `fetchNarrative === hovered && score !== null`. React Query dedupes per-studentId. |
| Factor breakdown shows all active factors with weight | Filter `f.weight !== 0`, sort by `Math.abs(weight)` desc, render as a 2-col table. Positive weights red, negative weights green. |
| 300 ms hover intent + cancel on mouse-leave | `onMouseEnter` sets a `window.setTimeout(setHovered, 300)`; `onMouseLeave` clears the timer + sets `hovered=false`. Cleanup on unmount. |
| Insufficient-data tier should NOT trigger narrative fetch | `canFetchNarrative = !!riskScore && riskScore.score !== null && hovered`. |
| Card-row click still navigates to `/people/students/:id` | The `onOpen` button is unchanged — popover is anchored to the badge only, not the row. |
| 2 min stale for batch, 10 min stale for narratives | `staleTime: 2 * 60 * 1000` for batch query; `10 * 60 * 1000` for narrative query (more expensive call). |
| "Computing risk…" pill while batch loads + visual fallback to amount sort | `Loader2` pill in the sort row when `sortBy==='risk' && riskScoresQuery.isLoading`; `effectiveSort = sortBy === 'risk' && !scoresReady ? 'amount' : sortBy`. |
| TypeScript strict, no `any`, lucide-react icons reused | All new types are concrete; only `Loader2` + `Sparkles` icons used (already imported). No new deps. |

## Implementation choices / spec gaps

1. **Per-card `useQuery` for the lazy narrative.** The brief offered two options — a parent-managed `narrativeLoadFor` Set, or a per-card `useQuery({ enabled: hovered })` — and explicitly said "go with that" for the simpler per-card approach. Implemented per-card. React Query's per-`queryKey` dedup means two cards hovered in quick succession don't queue duplicate calls; closing the popover doesn't cancel the in-flight fetch (cache hits the next time the user re-hovers within 10 minutes). No bounded-concurrency layer needed for this UX.

2. **Popover positioning is hand-rolled (no positioning lib).** A simple `relative` wrapper on the badge + `absolute right-0 bottom-full mb-2 z-30` on the popover. Sits ABOVE the badge so it isn't clipped by the card's bottom edge when the card is the last in the list. The popover is mounted INSIDE the wrapper so moving the cursor from badge → popover doesn't fire `onMouseLeave` on the badge wrapper. Width is `w-72 max-w-xs` so it stays readable but doesn't overflow the card on narrow viewports.

3. **`sortBy` is local state, not URL/localStorage.** The brief said "Persist selected sort to local state" — interpreted as React state, not localStorage. If finance officers want URL-shareable sort, that's a follow-up.

4. **`effectiveSort` decision is purely on `riskScoresQuery.isLoading`.** If the risk-scores query *errors* (e.g. agent endpoint 503), we still show the pill-toggle in `'risk'` position visually but the sort silently returns the unsorted list (since every score is `undefined` → `-Infinity`, the secondary `overdueAmount` desc takes over). UX-wise this looks identical to amount-sort, which matches the spec's degraded-path requirement. No banner needed because the per-card badges show `Risk …` (the `'…'` glyph) which signals scores didn't arrive — ambiguous between loading and failed. Logged here as a minor UX observation; the spec didn't require an error banner for this query.

5. **`Risk —` wrap chrome.** When a student has `score === null` (insufficient-data), the wrap stays `bg-white border-slate-200` and the badge shows the em-dash. The spec said "neutral white bg + \u2014 badge" — implemented exactly.

6. **`refreshAll` invalidates `['risk-scores']`.** The toolbar refresh button now busts the risk-score cache too — without this, hitting refresh would only re-fetch dashboard + defaulters and risk scores would stay 2-min stale.

7. **Risk list subtitle re-worded.** The card title still says "Students requiring action — AI risk-sorted" (from A6's prior pass); the subtitle now reads "Ranked by deterministic risk score (hover a badge for the AI breakdown)" instead of the old "Ranked by overdue amount and days past due". This better reflects what the page actually does post-A8.

8. **No shared parent state for hover narratives.** Followed the simpler per-card approach. If A11 later needs telemetry on which narratives users actually viewed (e.g., to tune the prompt), a parent-level Set could be wired in by lifting `hovered` state up — but for now this is YAGNI.

9. **`aiRecommendation()` still drives the violet inline hint line.** The spec only spoke about replacing the severity tint and the day-counter badge — the rule-based one-liner under the name was left unchanged. Once a real per-student recommendation engine exists this can be swapped, but it's outside A8's scope.

10. **Backend response shape mirroring.** Confirmed by reading `backend/src/modules/juvi/finance-agent/service.ts` L106-112 + `risk-scorer.ts` L53-57: the `RiskScoreResult` and `RiskFactor` shapes line up exactly with the new frontend types. `score: number | null`, `tier: 'low'|'medium'|'high'|'critical'|'insufficient-data'`, `factors: { name, weight, value }[]`, `narrative?: string`.

## Violations

None. All edits respect:
- TypeScript strict (no `any`; the only `as` casts are pre-existing in the file).
- React Query patterns: explicit `queryKey`, per-key staleTime, `enabled` flag, `retry: false` on the narrative query (one shot per hover).
- Tailwind palette only (red/amber/slate/emerald/blue/violet — all already in use).
- lucide-react icons reused (`Sparkles`, `Loader2`); no new icon imports.
- No new dependencies (`package.json` untouched).
- Multi-tenancy: the backend filters by `req.collegeId`; the frontend never sends a college id in the body (axios interceptor attaches the `x-college-id` header).
- Card-row click still navigates to `/people/students/:id` (unchanged from prior behaviour).
- Insufficient-data students don't trigger LLM narrative calls (per the brief).

## Files

- Modified: `admin-portal/src/services/finance-agent.ts`, `admin-portal/src/pages/finance/FeeDashboardPage.tsx`.
- No new files.
- No backend changes.
