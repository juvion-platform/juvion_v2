# GATE 3 — Pre-Implementation Audit

**Feature:** 002-ai-assisted-config
**Date:** 2026-05-14
**Auditor:** lead (no async agent due to upstream timeout — done directly against the code)

## Summary

**PASS with 1 BLOCKING + 2 MINOR.** Plan and spec are largely accurate; one parameter-ordering bug in the cap-guard refactor would break existing tests if not corrected before Wave 1.

## Verified (plan is correct here)

- `ConfigField` interface at `backend/src/modules/platform/config-registry.ts:35` — adding optional `aiSuggestable?: boolean` is non-breaking; all 4 current schemas omit it.
- `validateAgainstSchema()` exists at `config-registry.ts:363`, exported — parser.ts can reuse as planned.
- `AuditAction` union at `shared/types.ts:26`; `FieldChange` at `shared/types.ts:61`. Neither yet has the additions the plan proposes — clean to extend.
- `tryClaimLLMSlot` lives at `modules/admissions/lead-scoring/cap-guard.ts:30`. Single internal call site (the lead-scoring service). Tests live at `__tests__/cap-guard.test.ts`.
- `backend/src/models/platform/` exists with 6 sibling models (`ConfigEntry`, `ERPNextBridgeConfig`, etc.) — `ConfigSuggestion.ts` slots in naturally.
- `admin-portal/src/pages/platform/SchemaConfigPage.tsx` exists (18.4 KB) — ready for Suggest-button extension.
- `admin-portal/src/services/platform-config.ts` exists — ready for new clients.
- No route conflicts: `/config/types`, `/config/:type/schema`, `/config/:type`, `/config/:type/:identifier` cover the existing paths. New routes `/config/:type/suggest` and `/config/suggestions/stats` are conflict-free as long as `/config/suggestions/stats` is registered BEFORE `/config/:type/:identifier` (Express order matters here).

## Drift / Plan corrections required

### BLOCKING

- **[B-1] Cap-guard parameter ordering would break existing tests.** Spec §10.1 / plan task 1.2 propose the new signature `tryClaimLLMSlot(collegeId, cap, namespace = 'lead-score', now = new Date())`. The current signature is `(collegeId, cap, now?: Date)` — and existing tests at `lead-scoring/__tests__/cap-guard.test.ts:61` invoke `tryClaimLLMSlot('college-A', 500, new Date('2026-05-14T10:00:00Z'))`, passing `now` as the 3rd positional arg. Inserting `namespace` as the 3rd positional would change `new Date(...)` from "now" to "namespace" — every existing test that uses the 3-arg form silently breaks.
  **Fix:** put `namespace` as the **4th** positional (default `'lead-score'`):
  ```typescript
  export async function tryClaimLLMSlot(
    collegeId: string,
    cap: number,
    now: Date = new Date(),
    namespace: string = 'lead-score',
  ): Promise<ClaimResult>
  ```
  New caller: `tryClaimLLMSlot(collegeId, cap, new Date(), 'config-suggest')`. Existing callers unaffected.

### MINOR

- **[M-1] Controller handler naming.** Plan §D mentions `suggestConfigHandler`. The existing controller convention uses `<verb>EntryHandler` (`upsertEntryHandler`, `getEntryHandler`, etc.). Stay consistent: name the new handler `suggestConfigHandler` is fine; the stats handler should be `configSuggestionsStatsHandler` (matches plan).

- **[M-2] Service function vs handler name.** Plan uses both `upsertConfigEntry` (service function) and `upsertEntryHandler` (controller). They are different. The plan should be explicit: extend the service function `upsertConfigEntry(collegeId, type, identifier, values, performedBy, aiAcceptedFields?)`. The handler at `config-controller.ts:46` (`upsertEntryHandler`) reads `aiAcceptedFields` from `req.body` and forwards.

## Additional context discovered

- `models/platform/` has 6 models but only 2 are re-exported through `models/index.ts` (`InferenceLog`, `IntegrationLog`). The other 4 (`ConfigEntry`, `ERPNextBridgeConfig`, `ImportJob`, `Policy`) aren't barrel-exported. Plan should follow whichever pattern the rest of the project uses for new models — barrel-exporting `ConfigSuggestion` keeps it accessible from `models/` namespace consumers.
- `admin-portal/src/services/platform-config.ts` style not yet inspected — plan task 5.0 should align with whatever the existing API client uses (axios + path constants).
- Test scaffolding for cap-guard mocks Redis at module level (`vi.mock('../../../config/redis', ...)`) — the same pattern applies to the new namespace-test addition.

## Recommendations before Wave 1

1. Apply the [B-1] correction to spec §10.1 and tasks.md Task 1.2.
2. Acknowledge [M-1] / [M-2] inline — no spec change required, just consistency awareness during Phase 8.

**Verdict:** PASS after [B-1] is applied. Proceed to Phase 8.
