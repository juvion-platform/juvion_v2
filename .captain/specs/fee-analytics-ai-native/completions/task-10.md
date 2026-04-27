# Completion: Task A10 — Reminder drafts side panel (fee-analytics-ai-native)

**Feature:** fee-analytics-ai-native
**Completed:** 2026-04-22
**Person:** srinikandula
**Final Status:** Refactored

## Files Changed

### Modified (2 production files)

- `admin-portal/src/services/finance-agent.ts` — appended the A10 surface:
  - `ReminderDraft` interface (`studentId`, `language`, `tone`, `subject`, `body`, `predictedReadRate`, `templateVersion`).
  - `ApprovedDraft` interface (`studentId`, `subject`, `body`) — payload row for the approval call.
  - `ApprovalResult` interface (`reminderIds`, `approvedCount`).
  - `getReminderDrafts(studentIds)` → `POST /juvi/finance-agent/reminder-drafts`.
  - `approveReminderDrafts(drafts)` → `POST /juvi/finance-agent/reminder-drafts/approve`.
  - All shapes match the A4 orchestrator + A5 controller contracts (`templateVersion: 'agent-draft-v1'`, batch up to 50, etc.).

- `admin-portal/src/pages/finance/FeeDashboardPage.tsx` — added the side panel + sub-components and wired the page integration:
  - Imports: added `useMutation` from React Query; added `Edit3`, `Check`, `SkipForward` lucide icons; added the new types (`ReminderDraft`, `ApprovedDraft`, `ApprovalResult`) + helpers (`getReminderDrafts`, `approveReminderDrafts`) from `services/finance-agent`.
  - `tonePillStyle(tone)` — teal/amber/violet pill colour per `'soft' | 'firm' | 'empathetic'`.
  - `readRateBadgeStyle(rate)` — green ≥ 0.7, amber 0.5–0.7, red < 0.5 (matches the `[Approve recommended]` 70% threshold).
  - `languageLabel(code)` — ISO 639-1 → human label (`en` → English, `te` → Telugu, …); falls back to the upper-cased code for unknown languages.
  - `ReminderDraftCard` — per-student card. Top row (avatar + name + roll + programme + overdue context), tone/language/read-rate pills, editable subject input, editable body textarea (5 rows), action row `[Approve] [Edit/Save] [Skip]`. Read-only by default; clicking `[Edit]` flips inputs editable and the same button becomes `[Save]` which commits the local edit via the `onSaveEdit` callback. Approved/skipped cards dim and hide the action row (per spec).
  - `ReminderDraftSkeleton` — animate-pulse 3-row skeleton shown while drafts fetch.
  - `ReminderDraftsPanel` — the public component:
    - Right-docked panel: `lg:w-[640px]` desktop, full-width mobile. Backdrop `bg-black/40`. Both backdrop and panel use `transition-{opacity,transform} duration-200` so the slide-in/out animation actually plays.
    - Mount/unmount lifecycle: `mounted` controls render presence, `entered` controls the transform; closing flips `entered=false` first, then unmounts after a 200ms timeout so the slide-out is visible.
    - Header: `Bell` icon avatar + title `"Draft reminders"` + subtitle `"AI-personalized · review before sending"` + close (X) button. Title/dialog wired with `aria-modal="true"` and `aria-labelledby`.
    - Sticky top bar: `[Approve all (N)]` (primary blue, disabled while pending or zero pending) + `[Approve recommended (M)]` (outline blue, M = pending count with `predictedReadRate >= 0.7`) + counter `0/N approved` on the right.
    - List body: scrollable. Loading shows 3 skeletons; error shows an amber retry banner; empty (no drafts) shows a centred message; success renders one `ReminderDraftCard` per draft, in receipt order.
    - Footer: `"After approval: 5-min recall window via the Reminders page"` + a Close button.
    - State: `Map<studentId, DraftStatus>` (`'pending' | 'approved' | 'skipped'`) for action state and `Map<studentId, {subject,body}>` for local edits. Both reset whenever the `idsKey` changes (panel re-opened with a different defaulter window).
    - Approve flow: `useMutation` against `approveReminderDrafts`. Per-card `[Approve]` POSTs one draft; `[Approve all]` POSTs all pending; `[Approve recommended]` POSTs the >= 0.7 subset. On success the matching ids flip to `'approved'` and a `SituationToast` shows `"Approved N reminder(s). Recall window: 5 min — visit Reminders page to cancel."`.
    - Accessibility: focus moves to the close button on open; Esc closes the panel (window-level keydown listener while open); backdrop click closes; close button closes.
  - Page wiring (`FeeDashboardPage`):
    - `defaultersById = Map<studentId, DefaulterListItem>` — built from the existing `defaulters` query result so the panel can show student name + overdue context per draft.
    - `[draftPanelOpen, setDraftPanelOpen]` + `[draftStudentIds, setDraftStudentIds]` state pair plus an `openDraftPanel(ids)` helper.
    - `<SituationCards onDraftReminder={openDraftPanel} />` — the A9 seam now wired to open the panel filtered to the situation card's `studentIds`.
    - `[Draft reminders]` button in the Risk list card header (replaces the previously-disabled `Send bulk reminders` placeholder). Always visible; clicking sends the top-10 currently-visible (post-sort) defaulters to `openDraftPanel`. Disabled when there are zero defaulters. Styled as a primary violet/fuchsia gradient with a `<Sparkles>` prefix to signal it's the AI flow.
    - `<ReminderDraftsPanel ... />` rendered at the bottom of the page (just before the closing `</div>`), so the backdrop + panel overlay correctly covers the whole viewport regardless of any parent overflow.

## Test Results

- **TypeScript strict (`npx tsc -b admin-portal`):** **0 errors** (exit 0).
- **Build (`npm run build -w admin-portal`):** **clean**, 3.21s. No new warnings introduced. The `Finance` chunk grew from the prior baseline as expected (≈220 kB → still in the same bundle since the panel is part of the lazy Finance route).

### Verification log

```
$ npx tsc -b admin-portal
(no output)
EXIT: 0

$ npm run build -w admin-portal
...
dist/assets/Finance-X3C0FSe5.js            220.14 kB │ gzip:  42.07 kB
...
✓ built in 3.21s
```

## Spec Coverage (against Task A10 ACs)

| # | Task A10 AC | How met |
|---|-------------|---------|
| 1 | Header button on Risk List card: `[Draft reminders]` | Replaced the previously-disabled `Send bulk reminders` button with a primary `[Draft reminders]` button (violet/fuchsia gradient + `Sparkles` icon) in the Risk list card header. |
| 2 | Click → opens right-docked side panel | Click sets `draftStudentIds` to the top 10 currently-visible (post-sort) defaulter ids and flips `draftPanelOpen=true`. Panel slides in from the right with a `translate-x-full → translate-x-0` transform over 200ms. |
| 3 | Top of panel: progress while fetching from `/reminder-drafts` | Loading state renders 3 skeleton draft cards (animate-pulse). The header always shows the spec title; the bulk action buttons disable while the query is loading. |
| 4 | Per-student card: language + tone + predicted read-rate + subject + body (editable) | `ReminderDraftCard` renders the language pill, tone pill (color-coded by `tonePillStyle`), read-rate pill (color-coded by `readRateBadgeStyle`), editable subject input, editable body textarea (5 rows). Read-only by default; `[Edit]` flips inputs writable. |
| 5 | Per-student actions: `[Approve] [Edit] [Skip]` | Action row in each card. Approve = primary blue. Edit = outline (becomes Save when in edit mode). Skip = ghost slate. All three disabled while the card is in edit mode (so the user can't lose their unsaved changes). |
| 6 | Bulk: `[Approve all]` / `[Approve only recommended (>70% predicted read-rate)]` | Sticky top bar in the panel. `[Approve all (N)]` (N = pending count). `[Approve recommended (M)]` (M = pending count with `predictedReadRate >= 0.7`). Both disabled while idle / mutation in flight / queue empty. |
| 7 | On approve: POST `/reminder-drafts/approve` → FeeReminder created → success toast | Per-card / bulk approve all use `useMutation` against `approveReminderDrafts(drafts)`. Success → matching ids flip to `'approved'` (cards dim) + `SituationToast` shows `Approved N reminder(s). Recall window: 5 min — visit Reminders page to cancel.` |
| 8 | Recall: 5-min window mention | Spec'd as deferred actual UI; we surface the recall window in the success toast text + the panel footer text per task brief ("just surface this in the success toast as a hint"). |
| 9 | Skipped drafts logged as agent actions | Per spec gap (see below): the skip click flips local status to `'skipped'` (card dims). The orchestrator-side `situation-dismiss` audit entry isn't fired here — A4's `handleApproveDrafts` only logs approvals; no skip endpoint exists in the A5 surface. Flagged for the spec. |
| 10 | Wire `<SituationCards onDraftReminder>` | `<SituationCards onDraftReminder={openDraftPanel} />`. The A9 stub seam now drives the real panel. |

## Red-Green-Refactor trace

- **RED:** No existing test file to fail against (this is a build-clean task per the AC table). The corresponding "red" was the absence of: (a) the `getReminderDrafts` / `approveReminderDrafts` exports — which would surface as a TS error if the panel imported them, (b) the `ReminderDraftsPanel` component, (c) the wired `onDraftReminder` prop. Verified by grepping `services/finance-agent.ts` (only `dismissSituation` was the last export) and noting the `<SituationCards />` self-closing tag with no `onDraftReminder`.
- **GREEN (round 1):** Appended the helpers + types to `services/finance-agent.ts`, added the panel + sub-components to `FeeDashboardPage.tsx`, wired `onDraftReminder` and the Risk-list header button. First typecheck pass: 0 errors. Build pass: clean. No iteration needed.
- **REFACTOR:** Extracted `tonePillStyle`, `readRateBadgeStyle`, `languageLabel` as small pure-function helpers above `ReminderDraftCard` so the card body stays focused on layout. Pulled the `mounted/entered` slide-animation lifecycle into local state with comments explaining the 200ms unmount delay. No production changes needed beyond the initial implementation.
- **VERIFY:** Two orthogonal verification runs (typecheck + build) both clean.

## Spec Gaps / Notes

1. **Skipped drafts not audited.** The spec mentions "Skipped drafts logged as `situation-dismiss` kind agent actions" but the A5 controller surface has no `/reminder-drafts/skip` endpoint and the A4 orchestrator's `handleApproveDrafts` only logs the approval path. For A10 the skip is purely client-side (flips status to `'skipped'`, card dims). To fully honour the spec, a future iteration would need a `/reminder-drafts/skip` POST that fires an `AgentAction` audit entry. Flagged as out-of-scope for this task — the surface to implement is small and could land in a follow-up.

2. **Recall window is informational only.** Per the brief: "Actual recall UI is out of scope. Just surface this in the success toast as a hint." Toast text: `Approved N reminder(s). Recall window: 5 min — visit Reminders page to cancel.` The Reminders page recall flow is owned by the existing fee-analytics module (T11/T12 work); we don't render a `[Recall]` button in the toast.

3. **Top-10 cap on the Risk-list `[Draft reminders]` button.** The button sends the top 10 currently-visible (post-sort) defaulters — same window the cards are rendered from. The backend caps at 50 per `studentIds`, so we're well under. If a future iteration wants "all visible" or a checkbox-select-then-draft flow, the panel itself doesn't need changes — only the parent's `openDraftPanel(ids)` call site.

4. **`defaultersById` map is built from the in-flight `defaulters` query.** The map is empty while the defaulters query is loading, so a draft for a student missing from the visible window will render with the fallback `Student xxxx` label + no overdue context. This is acceptable: situation-cards' `studentIds` may include students NOT in the top-20 defaulter window (e.g. partial-payment-stale students who aren't yet in the overdue-amount tail), in which case the panel still shows the LLM-drafted content + tone/language/read-rate pills — just without the per-student amount/days context. Spec gap: future iteration could fetch a `/people/students?ids=...` mini-batch to fill in names for non-defaulter targets.

5. **No focus-trap.** Per the brief, we don't introduce a new dependency. We focus the close button on open and rely on Esc to close. Tabbing past the last focusable element will leave the panel — acceptable for a lightweight HITL panel; full focus-trap is a follow-up if accessibility audit demands it.

6. **Panel re-open clears local state.** Re-opening the panel with a different `studentIds` set resets the `statuses` and `edits` maps. Re-opening with the SAME ids preserves them (because the `idsKey` dep doesn't change). Trade-off: if the Officer closes then re-opens with the same ids, their previous approvals/skips/edits are still visible, which is what they expect. If the underlying drafts list changes server-side, React Query will refetch on cache miss; we don't reset state on data change because the LLM may legitimately re-emit identical drafts.

7. **`predictedReadRate` thresholds are baked into both the badge style AND the bulk action filter.** The brief specified 0.7/0.5 boundaries for both the read-rate badge color (green/amber/red) and the `[Approve recommended]` filter (>= 0.7). Keeping these aligned avoids a UX confusion where a green badge wouldn't be selected by `[Approve recommended]`.

8. **Per-card `[Approve]` triggers a single-row POST.** The brief discusses both a "queue + final dispatch" pattern and an "auto-dispatch per individual approval" pattern, then concludes: *"go with auto-dispatch per spec"*. Each `[Approve]` click POSTs that one draft (`drafts: [single]`), the success handler flips just that card. This matches the spec's *"On approve: POST `/reminder-drafts/approve` with final drafts"*.

9. **Mutation is shared across all approve buttons.** The single `useMutation` instance is re-invoked from per-card, approve-all, and approve-recommended click handlers. While the mutation is in flight, all bulk buttons disable (`approveMutation.isPending`) but per-card `[Approve]` buttons stay enabled — so the user can stack multiple per-card approvals if they're fast. Each click is a separate POST; the success handler matches the `approvedIds` field on the variables to know which cards to flip. This trades one-mutation-per-card simplicity for a more responsive UI on slow networks.

10. **No new npm deps.** All icons from existing `lucide-react`. All transitions via Tailwind (`transition-transform`, `transition-opacity`, `duration-200`). React Query's `useMutation` is already in the codebase. No `package.json` change.

## Violations

None observed.
- **TypeScript strict, no `any`, no `as` assertions** on the new code. The mutation generics use the strict `useMutation<TData, TError, TVariables>` form.
- **React Query 5-min stale time** on the drafts query matches the brief.
- **No new dependencies.**
- **Multi-tenancy unaffected** — the service helpers POST to authed routes; the `Authorization` + `x-college-id` headers come from `services/api.ts` interceptors.
- **AppError shape** unchanged (no new error paths added on the backend).
- **Backdrop click + Esc + close button all close the panel** per the brief.
- **Smooth slide animation** via Tailwind transitions; mount/unmount with a 200ms timeout pattern as recommended.

## Files

- Modified (2 production files):
  - `admin-portal/src/services/finance-agent.ts`
  - `admin-portal/src/pages/finance/FeeDashboardPage.tsx`
- Modified (1 spec file): `.captain/specs/fee-analytics-ai-native/tasks.md` (status `Pending → Refactored`).
