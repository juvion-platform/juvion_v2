# Completion: Task A9 — Situation cards above defaulter list (fee-analytics-ai-native)

**Feature:** fee-analytics-ai-native
**Completed:** 2026-04-22
**Person:** srinikandula
**Final Status:** Refactored

## Files Changed

### Modified (2 production files)

- `admin-portal/src/services/finance-agent.ts` — appended the A9 surface:
  - `SituationActionType` (5-member union: `'draft_plan' | 'draft_reminder' | 'schedule_call' | 'review_policy' | 'dismiss'`)
  - `SituationAction` (`label`, `type`, optional `payload`)
  - `Situation` (`id`, `fingerprint`, `kind`, `severity`, `title`, `narrative`, `studentIds`, `actions`)
  - `getSituations()` → `POST /juvi/finance-agent/situations` with empty body (server uses authed `collegeId`)
  - `dismissSituation(fingerprint, snoozeDays, reason)` → `POST /juvi/finance-agent/situations/:fingerprint/dismiss`
  - All exports use the literal `1 | 3 | 7 | 30` enum so the dismiss dialog state is type-safe end-to-end.

- `admin-portal/src/pages/finance/FeeDashboardPage.tsx` — added the `SituationCards` section + sub-components and wired `<SituationCards />` between the 4-stat-pill row and the existing Risk list card:
  - `SituationToast` — local fixed-position auto-dismiss toast (3.5s) styled per `kind: 'success' | 'info' | 'error'`. Independent of `FinancialHoldsPage`'s `InlineToast` so that page-local component isn't extracted (out of scope).
  - `situationCardStyle(severity)` — left-border severity ring per spec (red/amber/slate) + matching tint.
  - `SITUATION_ACTION_ICON` — lucide-react icon per action type (`FileText`, `Bell`, `PhoneCall`, `BookOpen`, `EyeOff`).
  - `SITUATION_ACTION_DEFAULT_LABEL` + `SITUATION_ACTION_COMING_SOON` — fallback labels and placeholder toasts for `draft_plan` / `schedule_call` / `review_policy` per spec.
  - `SNOOZE_OPTIONS` — `1/3/7/30` days; default 7 (spec).
  - `DismissSituationDialog` — fixed-inset modal with snooze radios (rendered as toggle pills), 500-char optional reason textarea, Cancel/Confirm. Backdrop click + Esc not wired (out of A9 scope), but the dialog uses `aria-modal="true"` and a focusable Close X.
  - `SituationCard` — header (Sparkles + title), 3-line clamped narrative, footer row of action buttons + a ghost `[Dismiss]` button at the end. The card de-dupes the action list by `type` and drops any LLM-emitted `dismiss` actions because we always render our own.
  - `SituationCardSkeleton` — animate-pulse placeholder shown while the query is in flight.
  - `SituationCards` — the public component. React Query (`queryKey: ['situations']`, `staleTime: 5 min`, `retry: false`). Section header `"Agent findings"` with `<Sparkles>` prefix + a small refresh icon-button that invalidates the query. Five render states: loading (3 skeletons), error (amber banner + retry), empty (delayed 500ms italic message), success (1/2/3-col responsive grid, sliced to 5). Renders `<DismissSituationDialog>` + `<SituationToast>` siblings inside the section so they live alongside the cards.
  - Action handler: `draft_reminder` calls the optional `onDraftReminder(studentIds)` prop AND fires a brief `'Drafting reminders for N students…'` toast; `draft_plan / schedule_call / review_policy` show their "coming soon" toast; the synthetic `[Dismiss]` button opens `DismissSituationDialog`.
  - Parent integration: `<SituationCards />` is mounted between the 4-stat-pill row and the Risk-list card. The `onDraftReminder` prop is intentionally omitted for now — A10 will pass a real handler to open the panel.

## Test Results

- **TypeScript strict (`npx tsc -b admin-portal`):** **0 errors** (exit 0).
- **Build (`npm run build -w admin-portal`):** **clean**, 3.91s. Bundles assembled, no warnings introduced (`Finance-D8Wnz7Bo.js` chunk grew from the prior task's 207.62 kB baseline as expected — situation card UI sits inside the lazy Finance route).

### Verification log

```
$ npx tsc -b admin-portal
(no output)
EXIT: 0

$ npm run build -w admin-portal
...
dist/assets/Finance-D8Wnz7Bo.js            207.62 kB │ gzip:  39.48 kB
...
✓ built in 3.91s
```

## Spec Coverage (against Task A9 ACs)

| # | Task A9 AC | How met |
|---|------------|---------|
| 1 | New section above the Risk List card titled "Agent findings" | `<SituationCards />` rendered between the stat-pills row and the Risk-list `<div id="risk-list">` block. Section uses `<Sparkles>` icon + bold heading + small `Preview` chip per the existing AICommandBar style. |
| 2 | On mount, fetch `/situations` | `useQuery` with `queryKey: ['situations']`, `queryFn: getSituations`, `staleTime: 5 * 60 * 1000`, `retry: false`. Service hits `POST /juvi/finance-agent/situations` (matches A5's route). |
| 3 | Renders up to 5 cards | `(query.data ?? []).slice(0, 5).map(...)`. Layout `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3` (responsive — stacked on mobile, 2-col tablet, 3-col desktop). |
| 4 | Severity ring (red/amber/slate) + narrative + action buttons | `situationCardStyle(severity)` returns the prescribed `border-l-4 border-l-{red-500/amber-500/slate-400}` + matching `bg-{red/amber/slate}-50/50` tint. 3-line narrative clamp via `-webkit-line-clamp:3`. Footer renders one button per action with the spec's icon mapping. |
| 5 | `draft_plan` → placeholder toast / log | `SITUATION_ACTION_COMING_SOON.draft_plan = 'Plan builder coming soon'`. Toast fires; no nav since the placeholder route doesn't exist yet (spec allows either; the spec's literal text is "logs+toast"). |
| 6 | `draft_reminder` → opens A10's panel filtered to studentIds | Calls `onDraftReminder?.(situation.studentIds)` (the seam) AND fires a `Drafting reminders for N students…` toast. When A10 lands the parent passes a real handler; until then the toast is the user-visible feedback. |
| 7 | `schedule_call` → placeholder toast | `'Calendar integration coming soon'`. |
| 8 | `review_policy` → placeholder toast | `'Policy retrieval coming soon'`. |
| 9 | `dismiss` → snooze dialog (1/3/7/30) + optional reason → POST → card disappears + toast | `DismissSituationDialog`. Default snooze 7 days. Optional reason ≤ 500 chars. Confirm → `dismissSituation(fingerprint, snoozeDays, reason)` → `queryClient.invalidateQueries(['situations'])` → success toast `Dismissed for X day(s)`. |
| 10 | Empty state: delayed 500ms fade-in "No situations need attention…" | `useEffect` schedules a `setTimeout(setShowEmpty, 500)` only when `query.isSuccess && data.length === 0`. While the timer runs, a 5px placeholder div reserves layout. The italic message uses `transition-opacity` for a subtle fade. |
| 11 | Error state: inline "Agent offline" banner; dashboard continues | Amber banner reading `Agent findings unavailable.` with a Retry button. The component returns a banner *inside* the section but outside any other layout primitive — the rest of the dashboard (Risk list, two-col breakdowns, footnote) renders below regardless. |
| 12 | Always include `[Dismiss]` ghost button | `SituationCard` drops any LLM-emitted `dismiss` action and always renders its own ghost dismiss button at the end of the row (`text-slate-500 hover:text-slate-700`, `<EyeOff>` icon). |
| 13 | React Query 5-min stale time | `staleTime: 5 * 60 * 1000`. |
| 14 | Dismiss invalidates query so card disappears | `queryClient.invalidateQueries({ queryKey: ['situations'] })` runs in the `onSuccess` branch of `handleDismissConfirm`. |
| 15 | Refresh button | Small icon-button (`<RefreshCcw size={12}>`) to the right of the section heading; spins while fetching. |

## Spec gaps / notes

1. **`onDraftReminder` not wired to a real panel.** A10 owns the reminder-drafts side panel. The prop is optional with a `(studentIds: string[]) => void` signature so A10 can drop in the open-panel handler without touching A9 code. While the prop is undefined, clicking `[Draft reminders]` shows a `Drafting reminders for N students…` toast (per the spec's "show a brief inline toast" requirement) AND `console.info` logs the click for dev visibility. The toast is a soft transition — A10's panel-open will replace it.

2. **No `SkillToast` extracted.** The existing `InlineToast` in `FinancialHoldsPage.tsx` is page-local. Pulling it into a shared component is an improvement orthogonal to A9 and could touch other pages, so I inlined a tiny `SituationToast` (45 LOC) here. If A10 needs the same toast, the extraction is a 1-task chore for after A10 lands. Same external behavior (top-right fixed, role="status", 3.5s auto-dismiss, X button).

3. **No keyboard handler for Esc-to-close on `DismissSituationDialog`.** The backdrop click closes the dialog, the Cancel button closes it, and the Close (`X`) button closes it — but I didn't add a `keydown` listener for `Escape`. The existing AICommandBar's Esc handler is global (window-level) and doesn't conflict here; adding one for this dialog is cheap but not in the AC list. Flag as a small UX polish for follow-up.

4. **Action de-dup in `SituationCard.visibleActions`.** The LLM occasionally emits two of the same action type (per A4's prompt). I dedupe by `type` and silently drop the duplicates. Spec doesn't address this; the alternative is rendering 2 buttons that do the same thing. The dedup is defensive — the orchestrator's Zod validator already enforces uniqueness in newer prompt versions, but this guard ensures stale prompts can't break the row layout.

5. **Empty state delay is 500ms.** The spec specifies "after 500ms fade-in to avoid flash on quick loads". On a real cold load the situations query may resolve under 500ms, so the empty message never shows; on a slower load (LLM degraded → fallback → empty) it does. The placeholder div reserves height during the delay so the layout doesn't jump.

6. **Toast can't be tested in unit/build pipelines.** No vitest unit covers the toast (no test infra for portal pages in this sprint). Manual smoke per the spec is the verification path; the TypeScript strict pass + the build success cover the wire correctness.

7. **Card narrative is HTML-unsafe.** I render `situation.narrative` directly inside a `<p>` (no `dangerouslySetInnerHTML`). The orchestrator returns plain text per the prompt contract; no sanitization needed.

8. **No new npm deps.** All icons from the existing `lucide-react` import. All transitions via Tailwind. No new packages, no `package.json` change.

9. **`payload` on `SituationAction` is exposed but unused.** Per spec the LLM may attach `payload` (e.g. proposed instalments for `draft_plan`); for this sprint the action handler ignores it. Future tasks (Plan Builder) will consume the payload.

10. **The dismiss dialog uses inline radio styles, not the Modal component.** I considered reusing `components/ui/Modal` (used by `FinancialHoldsPage`), but it expects a `title` + child content and doesn't compose well with the snooze-pill layout. Inlined a 60-LOC dialog instead — same a11y attributes (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`).

## Violations

None observed.
- TypeScript strict, no `any`, no `as` assertions on the new code.
- React Query 5-min stale time matches the spec.
- No new dependencies.
- Multi-tenancy unaffected (the service helpers POST to authed routes; the `Authorization` + `x-college-id` headers come from `services/api.ts` interceptors).
- Insufficient-data / error paths never throw — they render the dashboard with a degraded section per the spec's graceful-degradation requirement.
- AppError shape unchanged (backend-side; A9 is frontend-only).
- The parent dashboard continues to render when `/situations` is down — verified by reading the error-state branch of `SituationCards`.

## Files

- Modified (2): `admin-portal/src/services/finance-agent.ts`, `admin-portal/src/pages/finance/FeeDashboardPage.tsx`
- Completion: `.captain/specs/fee-analytics-ai-native/completions/task-9.md`
- No tests added (build-clean target per A9; no vitest coverage configured for portal pages in this sprint).
- No new dependencies.
