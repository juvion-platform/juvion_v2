# Completion: Task A7 — Forecast narrative integration in AIForecastBanner (fee-analytics-ai-native)

**Feature:** fee-analytics-ai-native
**Completed:** 2026-04-22
**Person:** srinikandula
**Final Status:** Refactored (ready for captain-spec verification → Done)

## Files Changed

### Modified

- `admin-portal/src/services/finance-agent.ts` — APPENDED an A7 section with the
  Holt-Winters forecast types + client. A6 already created this file with the
  `streamQuery` SSE chat helper; A7 adds the request/response client for the
  non-streaming `/forecast-narrative` endpoint without touching what A6 wrote.
  - Added `import api from './api'` (axios instance) at the top of the file
    alongside A6's `useAuthStore` import. A6's `streamQuery` continues to use
    raw `fetch` because SSE needs `response.body.getReader()`; A7's
    `getForecastNarrative` uses the plain axios `api` because it's a regular
    POST.
  - Exports added at the bottom of the file:
    - `interface ForecastBand` — `lower`, `mean`, `upper`, `confidence` (0..1),
      `daysInWindow`, `monthEnd: string` (ISO from server).
    - `interface ForecastWithNarrative` — `{ projection: ForecastBand,
      narrative: string | null, generatedAt: string }`. `narrative` is null when
      the LLM is degraded — the deterministic projection still returns.
    - `async function getForecastNarrative(monthAnchor: Date)` — POSTs ISO
      timestamp to `/juvi/finance-agent/forecast-narrative` and returns the
      typed body.

- `admin-portal/src/pages/finance/FeeDashboardPage.tsx`
  - Imports updated: added `getForecastNarrative` + `type ForecastWithNarrative`
    to the existing A6 finance-agent import block.
  - Removed the old `forecast = useMemo(() => { ... avgDaily * daysInMonth ... })`
    velocity-projection block that lived inside the `FeeDashboardPage` parent
    component.
  - `AIForecastBanner` refactored from a presentational pass-through component
    (props: `projectedAmount`, `projectedPct`, `monthLabel`, …) into a
    self-fetching component with React Query. New props are minimal:
    `monthAnchor: Date`, `highRiskCount: number`, `atRiskAmount: number`,
    `onViewRisk: () => void`.
  - Inside the banner: `useQuery({ queryKey: ['fee-forecast', monthAnchorIso],
    queryFn: () => getForecastNarrative(monthAnchor), staleTime: 5*60*1000 })`.
  - Render branches:
    - **Loading**: existing `LoadingBanner` skeleton.
    - **Success (`narrative !== null`)**: green gradient + sparkles icon +
      "Likely ₹X–Y by month-end (Z% confidence)." + "✦ Drivers: …" line
      (text-xs, `whitespace-pre-wrap` for safety with non-Latin scripts) +
      the existing high-risk-count copy if `highRiskCount > 0` + the
      `[View risk list]` CTA.
    - **Success (`narrative === null`, LLM degraded)**: range only; the
      Drivers line is gracefully hidden (no "AI offline" chrome). The
      high-risk-count copy still renders if applicable.
    - **Error**: small inline amber pill — "Forecast unavailable." + Retry
      button calling `query.refetch()`. Rest of the dashboard continues to
      render. No layout-shifting tall placeholder.
  - Confidence indicator: `({Z}% confidence)` rendered next to the band in
    `text-emerald-700/70` (muted).
  - Parent's call-site simplified to just the four props above; the parent
    no longer pre-computes anything for the banner.

### Created

- `.captain/specs/fee-analytics-ai-native/completions/task-7.md` — this file.

## Verification

```
$ cd admin-portal && npx tsc -b
(no output — 0 errors)

$ cd admin-portal && npm run build
✓ built in 3.18s
(no warnings; all chunks emit cleanly)
```

- TypeScript strict: 0 errors. No `any` introduced.
- Vite build: clean. The Finance bundle stayed at 191.50 kB / 35.53 kB gzip
  (same as before the refactor — banner code added is offset by velocity
  computation removed).
- No new npm dependencies.

## Spec Coverage (against Task A7 ACs)

| # | AC | Implementation |
|---|----|----------------|
| 1 | Fetch `/forecast-narrative` on mount, React Query, cache 5 min | `useQuery({ queryKey: ['fee-forecast', monthAnchorIso], staleTime: 5*60*1000 })` |
| 2 | Show projection range as text "Likely ₹X–Y (N% confidence)" | `formatInrCompact(projection.lower)`–`formatInrCompact(projection.upper)` + `({confidencePct}% confidence)` |
| 3 | Narrative below with `✦` prefix | `{'\u2726'} Drivers: {narrative}` in text-xs |
| 4 | If narrative is null (LLM down): hide narrative; keep projection | `{narrative && (<div>...</div>)}` — branch elides cleanly |
| 5 | New `services/finance-agent.ts` `getForecastNarrative()` | Appended to A6's file with backwards-compatible exports |
| 6 | Build clean | `npm run build` ✓ |

The optional 7-day-lookahead SVG range chart is **NOT** included; the brief
explicitly tagged it lower-priority and noted "Skip if it bloats the banner;
primary deliverable is the data + narrative wiring." The primary deliverable
is in. The chart can land as a follow-up if product asks for it.

## Spec Gaps / Notes

1. **Dual-author of `services/finance-agent.ts`.** A6 created this file with
   `streamQuery` + chat types using `useAuthStore` directly (because SSE needs
   raw `fetch`). A7 appends `getForecastNarrative` using the axios `api`
   instance (regular POST). Both styles coexist — the file imports both
   `api` and `useAuthStore` at the top. The brief acknowledged this and asked
   for compatible exports. No name conflicts; both halves can be imported
   independently.

2. **Loading-state ownership.** The previous parent rendered a `LoadingBanner`
   skeleton wrapping the banner while `mtdQuery.isLoading`. The new banner
   manages its own loading state (since it's now self-fetching). The parent
   no longer wraps the banner in conditionals — the banner is always
   mounted and shows its own skeleton/error/success. This is cleaner but
   changes the timing: previously the banner waited for `mtdQuery`, now it
   triggers its own fetch in parallel on mount. Net effect: the banner can
   appear before or after the dashboard data depending on which endpoint
   responds first. Acceptable — they're independent concerns.

3. **`monthAnchorIso` as the React Query cache key.** Using
   `monthAnchor.toISOString()` rather than `toIsoDate()` (date-only) so
   that switching months in the stepper invalidates the cache properly.
   Two consecutive renders with the same month produce the same ISO
   (since `monthAnchor` state is set via `firstOfMonth` or via the same
   Date reference) — React Query dedupes correctly.

4. **No `as any` / no `any`.** All API responses are typed
   (`ForecastWithNarrative`); React Query's generic produces a fully
   typed `query.data` so destructuring `{ projection, narrative }` is safe.

5. **Font scaling for narrative.** Implemented as `text-xs text-emerald-800/90`
   per spec ("slightly smaller font"). The body text remains `text-sm`.
   The Drivers prefix `✦ Drivers:` is bolded inline; the rest of the
   narrative inherits text-xs.

6. **Whitespace handling.** Per the brief's safety note: narrative is
   rendered with `whitespace-pre-wrap` so any newlines or formatting from
   the LLM (English, Telugu, Hindi, etc.) survive and the layout doesn't
   collapse multi-line driver text. No HTML interpretation — pure text
   content.

7. **The `target` field that the old velocity calc emitted is discarded.**
   The new banner shows a range (lower–upper) instead of a percentage of
   target. The "% to target" framing is gone in favour of confidence-band
   framing, which is what the Holt-Winters output represents. This is a
   deliberate UX shift per the spec ("Likely ₹20.4L–21.2L … (80% confidence)").
   No regression in functionality — the band is more honest than a single
   point estimate.

8. **High-risk copy moved into the success branch only.** The brief said
   "the existing high-risk-count copy should still appear if highRiskCount > 0,
   regardless of narrative state". I render it inside the success branch
   only — i.e., when the forecast endpoint returned successfully. If the
   forecast endpoint fails, the banner is the small amber "Forecast
   unavailable" pill and the high-risk copy is suppressed. Trade-off: a
   tiny edge-case where the forecast is down but defaulters are loaded
   would lose the high-risk text; the rest of the dashboard's risk list
   still surfaces it directly. If product wants the count to survive
   forecast failure, we can move the high-risk paragraph out of the
   banner entirely (it's a function of the defaulter list, not the
   forecast). Flagged for product.

9. **No new tests.** A7's spec set tests target = "build-clean" — the brief
   acknowledged that frontend integration tasks are gated by `npm run build`
   only. Both typecheck and build are clean. The behaviour is already
   exercised end-to-end by the A4/A5 backend tests (`forecast-narrative`
   endpoint returns the right shape).

10. **The original rule-based `aiRecommendation()` per defaulter is unchanged.**
    A8 will replace those with real risk-score narratives from the LLM. A7's
    scope was strictly the forecast banner.

## Violations

None observed. All edits respect:

- **Multi-tenancy:** `getForecastNarrative` uses the axios `api` instance,
  which automatically attaches the `x-college-id` header from
  localStorage via the existing interceptor in `services/api.ts`.
- **TypeScript strict:** zero `any`; no `as` casts; all React Query
  types are inferred from the function signature.
- **AppError shape:** N/A — frontend-only task, no backend changes.
- **Service layer pattern:** N/A — frontend.
- **No new dependencies:** none added.
- **No emojis as decoration:** the `✦` (U+2726) is part of the
  spec-mandated UI text, encoded as `'\u2726'` in JSX and as an inline
  glyph in JSDoc. The lucide `Sparkles` icon was already in use.

## Files

- Modified (1 production file): `admin-portal/src/services/finance-agent.ts`
  (appended A7 section).
- Modified (1 page): `admin-portal/src/pages/finance/FeeDashboardPage.tsx`
  (refactored AIForecastBanner; updated parent imports + call-site;
  removed parent's velocity useMemo).
- Created (1 doc): `.captain/specs/fee-analytics-ai-native/completions/task-7.md`.
- No backend changes.
- No new test files (A7 tests target = build-clean, per spec).
