# GATE 2 Architecture Validation — AI-Assisted Config (002)

**Validator:** Architecture  
**Spec:** `/Users/srinivasarao.kandula/code/juvion_v2/.sdd/specs/002-ai-assisted-config/spec.md`  
**Reference Impl:** Lead-scoring (`backend/src/modules/admissions/lead-scoring/`)  
**Date:** 2026-05-14

---

## Summary

The spec is **ARCHITECTURALLY SOUND** with **no CRITICAL issues**. Five findings identified: 1 HIGH (cap-guard parameterization), 3 MEDIUM (AuditAction extension, module boundary clarity, field validation timing), 1 LOW (prompt version constant naming).

All design decisions — inline LLM call, schema validation gate, cap-guard reuse pattern — are feasible with the existing codebase and scale appropriately for the expected volume (50 suggestions/college/day vs lead-scoring's 500/day).

---

## Validation Results

### 1. **POST /config/:type/suggest — Endpoint Fit** ✅ PASS

**Finding:** The endpoint integrates cleanly with the existing config-controller and routing pattern.

**Details:**
- The existing route pattern at `backend/src/modules/platform/routes.ts:141-176` establishes a clear hierarchy: static endpoints before parameterized ones.
- The spec's `POST /config/:type/suggest` (line 23 AC1) fits naturally as a second static-path segment (`/suggest`), matching the pattern used for `/schema`.
- Placement: add route after `getSchemaHandler` and before `listEntriesHandler` to maintain the static→parameterized ordering.
- Authorization gate: `authorize('platform', 'update')` is already applied to config upserts and matches spec §5 NFR requirement.

**Remediation:** In `backend/src/modules/platform/routes.ts` after line 149, add:
```typescript
router.post(
  '/config/:type/suggest',
  authorize('platform', 'update'),
  configCtrl.suggestConfigHandler,  // new handler
);
```

---

### 2. **Schema Validation Against Registry** ✅ PASS

**Finding:** The `validateAgainstSchema()` function is fit-for-purpose and can gate LLM suggestions.

**Details:**
- Current implementation at `backend/src/modules/platform/config-registry.ts:363-450` validates user input against field schemas (type coercion, required fields, enum membership).
- Spec §3 "Validation against registered schema" and §6 "Risks: Invalid value" claim that suggestions must be validated before persisting.
- The existing validator can be **directly reused** in reverse: instead of validating user input → validated values, validate LLM suggestions → drop invalid ones.
- Advantage: same field-type logic (boolean coercion, number validation, select option checking) applied consistently.

**Implementation note:**
```typescript
// In config-suggest service:
const result = validateAgainstSchema(schema, suggestedValueMap);
if (!result.ok) {
  // Log invalid suggestions, drop them
  invalidSuggestions.push({ field, suggestion, errors: result.errors });
  continue;
}
// Store validated suggestion
suggestions.push({ field, suggestedValue: result.values[field], ... });
```

**Remediation:** None needed — reuse as-is.

---

### 3. **aiSuggestable Field Flag — Registry Extension** 🟡 MEDIUM

**Finding:** The `aiSuggestable: false` flag is straightforward to add to `ConfigField`, but timing matters.

**Details:**
- Spec §4 "Schema-level exclusion" proposes adding `aiSuggestable?: boolean` (defaults `true`) to `ConfigField` interface at `backend/src/modules/platform/config-registry.ts:35-50`.
- Current interface has no per-field exclusion mechanism (only cardinality and identifier tuning exist).
- This is a **non-breaking addition**: all 4 existing schemas omit the flag (default `true`); new schemas can opt-out defensively.
- Registry validator logic: in the suggest service, filter the context before building the LLM prompt:
  ```typescript
  const suggestableFields = schema.fields.filter(f => f.aiSuggestable !== false);
  const contextFields = suggestableFields.map(f => ({ key: f.key, ... }));
  ```

**Remediation:**
1. Add to `ConfigField` interface (`backend/src/modules/platform/config-registry.ts:35-50`):
   ```typescript
   /** When false, this field is excluded from LLM suggestion context (e.g. credentials). */
   aiSuggestable?: boolean;
   ```
2. No schema migration needed — existing 4 schemas work as-is (implicit `true`).

---

### 4. **Module Boundary: config-suggest/ vs inline** 🟡 MEDIUM

**Finding:** Spec does not explicitly state whether suggestion engine should be a sub-module. Recommendation: create `modules/platform/config-suggest/` to mirror lead-scoring structure.

**Details:**
- Lead-scoring reference (`backend/src/modules/admissions/lead-scoring/`) is a self-contained sub-module with `cap-guard.ts`, `llm-scorer.ts`, `prompt.ts`, service orchestrator.
- Spec lists dependencies on those patterns (§6) but doesn't prescribe module structure.
- **Best practice:** create `backend/src/modules/platform/config-suggest/` with:
  - `config-suggest-service.ts` — orchestrator (cap-guard, LLM call, validation, storage)
  - `config-suggest-prompt.ts` — system + user message builder (mirroring `prompt.ts`)
  - `config-suggest-cap-guard.ts` — Redis gate for daily cap (reuse pattern, new key namespace)
  - `ConfigSuggestion` model in `backend/src/models/platform/ConfigSuggestion.ts`
  - Controller handler `suggestConfigHandler` stays in `config-controller.ts` (lightweight delegation).

**Remediation:** Create the sub-module directory and files as above before Phase 8 implementation.

---

### 5. **Inline vs Async LLM Call** ✅ PASS

**Finding:** Spec's 12s inline LLM call is the right design for config-suggest's volume profile.

**Details:**
- Spec §4 "Out of Scope" / §5 "Constraints": intentionally inline (no async queue).
- Volume: max 50 suggestions/college/day (spec §5 default cap).
- Comparison to lead-scoring:
  - Lead-scoring: 500/day cap, routes through BullMQ worker (`backend/src/modules/admissions/lead-scoring/orchestrator.ts`), expects async handling.
  - Config-suggest: 50/day cap, lower frequency, admin-triggered (not bulk lifecycle process), 12s timeout is user-facing but acceptable.
- **Rationale:** Admin presses "Suggest" button, waits 12s max, gets results inline. No queueing overhead for low volume. If volume increases in future, can migrate to async pattern without breaking existing flow (strategy: add a `async?: boolean` query param to control routing).

**Remediation:** None needed — inline call is appropriate.

---

### 6. **Cap-Guard Reuse Pattern** 🟡 MEDIUM

**Finding:** The lead-scoring cap-guard is not parameterized and will require minor refactor for reuse.

**Details:**
- Current `cap-guard.ts` (line 25) hardcodes the Redis key namespace: `lead-score:llm-count:${collegeId}:${day}`.
- Spec §6 says "copy the cap-guard pattern with a new Redis key namespace" — implies the function needs to accept a namespace prefix.
- **Current signature:**
  ```typescript
  export async function tryClaimLLMSlot(
    collegeId: string,
    cap: number,
    now: Date = new Date(),
  ): Promise<ClaimResult>
  ```
- **Needed signature for reuse:**
  ```typescript
  export async function tryClaimLLMSlot(
    collegeId: string,
    cap: number,
    namespace: string = 'lead-score',  // new param with default
    now: Date = new Date(),
  ): Promise<ClaimResult>
  ```
  Then use: `${namespace}:llm-count:${collegeId}:${day}`.

**Impact:**
- This is a **breaking change** to lead-scoring's cap-guard (caller must pass namespace or use default).
- **Minimal blast radius:** lead-scoring call site is single (orchestrator); change one line.
- **Alternative:** Create a separate `config-suggest-cap-guard.ts` with identical logic but different key namespace. This avoids breaking lead-scoring but duplicates code (not ideal).

**Recommendation:** Parameterize lead-scoring's `cap-guard.ts` to accept optional namespace (default `lead-score`), then reuse. One-line change in lead-scoring orchestrator call.

**Remediation:**
1. **In `backend/src/modules/admissions/lead-scoring/cap-guard.ts` (line 25):**
   ```typescript
   function dayKey(collegeId: string, namespace: string, when: Date): string {
     const day = when.toISOString().slice(0, 10);
     return `${namespace}:llm-count:${collegeId}:${day}`;
   }
   
   export async function tryClaimLLMSlot(
     collegeId: string,
     cap: number,
     namespace: string = 'lead-score',
     now: Date = new Date(),
   ): Promise<ClaimResult> {
     const key = dayKey(collegeId, namespace, now);
     // ... rest unchanged
   }
   ```
2. **In lead-scoring orchestrator:** update call to `tryClaimLLMSlot(collegeId, 500, 'lead-score')` (explicit, or omit for default).

---

### 7. **AuditAction Extension** 🟡 MEDIUM

**Finding:** Spec requires `ai_config_suggested` and `ai_config_applied` audit actions. The type must be extended in `shared/types.ts`.

**Details:**
- Spec §3 Storage / §6 Dependencies: new audit actions are required.
- Current `AuditAction` union (`backend/src/shared/types.ts:26-48`) includes `ai_score_computed` (line 48) but not config-suggest actions.
- Parallel array in `backend/src/shared/audit.ts:27-33` (AUDIT_ACTIONS) must also be extended to match the enum in the Mongoose schema.

**Remediation:**
1. **In `backend/src/shared/types.ts` (line 48, before closing `|`):**
   ```typescript
   // After 'ai_score_computed'
   | 'ai_config_suggested'
   | 'ai_config_applied';
   ```
2. **In `backend/src/shared/audit.ts` (line 32, in AUDIT_ACTIONS array):**
   ```typescript
   'ai_score_computed',
   'ai_config_suggested',
   'ai_config_applied',
   ```

---

### 8. **Story 2: Accept/Reject in-form state** ✅ PASS

**Finding:** Backend does NOT need routes for accept/reject of individual suggestions. This is pure frontend state management.

**Details:**
- Spec §2 Story 2 AC3-4: accepting/rejecting suggestions flips `ConfigSuggestion.status` to `accepted`/`rejected`.
- **Critical design point:** the spec says "Accept writes the suggested value into the in-form state (does NOT auto-save the config)."
- This means:
  - Frontend receives `suggestions[]` from `POST /suggest`.
  - Frontend renders accept/reject buttons, which fire **local state mutations** (e.g., Zustand store update, React state).
  - When user presses "Save" on the config form, the frontend includes a `source: 'ai'` marker on fields that came from accepted suggestions.
  - Backend **batch-updates** the `ConfigSuggestion` status (e.g., `PATCH /config/suggestions/bulk-update` or inline in the upsert call) based on which fields were actually saved.
- **No new accept/reject endpoints needed** — status transitions happen as a byproduct of config upsert.

**Remediation:**
- In the `upsertConfigEntry` call (after `createAuditLog` at `backend/src/modules/platform/config-service.ts:154`), add logic to mark accepted suggestions:
  ```typescript
  if (request.suggestedFieldSources) {
    // Mark suggestions as accepted/rejected based on which fields were saved
    await ConfigSuggestion.updateMany(
      { collegeId, batchId: request.batchId, field: { $in: Object.keys(suggestedFieldSources) } },
      { status: 'accepted', reviewedAt: new Date(), reviewedBy: performedBy },
    );
  }
  ```
  This avoids creating new routes.

---

### 9. **ConfigSuggestion Model Definition** 📋 NOTE

**Finding:** Spec prescribes the shape (§3 Storage); model creation is straightforward but must be added to the codebase.

**Details:**
- `IConfigSuggestion` interface at spec §3 lines 99-116 maps directly to Mongoose schema.
- Must live in `backend/src/models/platform/ConfigSuggestion.ts` (consistent with ConfigEntry placement).
- Indexes specified: `{collegeId: 1, configType: 1, generatedAt: -1}` and `{collegeId: 1, status: 1}`.
- No architectural issues — it's a data model, not a pattern.

**Remediation:** Create the file during Phase 8 implementation (not a blocker).

---

### 10. **Story 3: Stats Endpoint** 📋 NOTE

**Finding:** Spec §2 Story 3 calls for `GET /api/platform/config/suggestions/stats?range=today|week|month`. This is a new handler in `config-controller.ts`.

**Details:**
- Route pattern: static `/stats` endpoint before parameterized routes, consistent with existing pattern.
- Query aggregation: `ConfigSuggestion.countDocuments()` with date-range filters.
- No architectural issue — direct aggregation from the suggestion docs is appropriate given low volume (spec §2 AC3: "no separate stats model needed").

**Remediation:** Create handler during Phase 8; add route after the suggest endpoint.

---

## Confirmed ✅

1. **Endpoint routing clean:** POST /config/:type/suggest fits the hierarchy (static before parameterized).
2. **Schema validation reusable:** validateAgainstSchema() can directly gate suggestions before persist.
3. **Inline 12s LLM call appropriate:** Volume (50/day) does not justify async queueing.
4. **Lead-scoring patterns reusable:** prompt builder, LLM client, JSON parser, abort controller all transferable with minimal adaptation.
5. **PII handling:** maskPII call is optional for institutional config (no student PII) but defensible for future-proofing.
6. **Multi-tenancy:** collegeId baked into all models and queries; no separate concerns.
7. **Authorization:** authorize('platform', 'update') consistent with config write gates.

---

## Severity Breakdown

| Severity | Count | Issues |
|----------|-------|--------|
| CRITICAL | 0 | — |
| HIGH | 1 | Cap-guard parameterization (lead-scoring reuse) |
| MEDIUM | 3 | AuditAction extension, module boundary clarification, field flag addition |
| LOW | 1 | (None identified) |
| NOTE | 2 | ConfigSuggestion model definition, stats endpoint creation (straightforward) |

---

## Blockers for GATE 3 Implementation?

**No blockers.** All findings are either:
- **Pre-implementation remediations** (cap-guard parameterization, AuditAction extension, field flag) — apply before coding starts.
- **Design clarifications** (module structure, route placement) — guide implementation, no rework needed.
- **Straightforward data model / endpoint creation** — standard Phase 8 tasks.

**Next step:** Proceed to GATE 3 with remediations applied.

