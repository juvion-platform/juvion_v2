# GATE 2 — API + Security Validation

## Summary
**PASS with 6 findings: 0 CRITICAL, 3 HIGH (cap-guard atomicity, HTTP contract clarity, audit lineage), and 3 MEDIUM (sensitive-field filtering location, PII masker reusability, stats endpoint multi-tenancy confirmation).**

---

## Findings

### 🟠 HIGH

#### 1. Rate-limit cap enforcement must use atomic Redis INCR (idempotency risk)
**Spec reference:** Story 3 AC#4 (line 25): "cap-guarded: `CONFIG_SUGGEST_DAILY_LLM_CAP` (default 50/college/day)"

**Current state:**
- Spec directs to copy `backend/src/modules/admissions/lead-scoring/cap-guard.ts` pattern.
- Verified: `cap-guard.ts` implements atomic Redis INCR + 24h TTL (lines 37–42).
- **Pattern is sound.** Recommend copying verbatim: `await redis.incr(counterKey); if (count === 1) await redis.expire(key, 86_400); if (count > cap) { await redis.decr(key); return { allowed: false, ... } }`

**Risk if deviates:**
- Two concurrent suggest requests on the same college could both see count < cap and proceed, exceeding the cap.
- Second request would bill the LLM even after cap was hit; unexpected cost.

**Recommended fix:**
Use the exact pattern from `cap-guard.ts` in `backend/src/modules/platform/config-suggestion/cap-guard.ts` (new file):
```typescript
const counterKey = `config-suggest:llm:${collegeId}:${new Date().toISOString().slice(0, 10)}`;
const count = await redis.incr(counterKey);
if (count === 1) await redis.expire(counterKey, 86_400);
if (count > dailyCap) {
  await redis.decr(counterKey);
  return { allowed: false, count: dailyCap, cap: dailyCap };
}
```

**Code location:** `backend/src/modules/platform/config-suggestion/cap-guard.ts` (new, copy from admissions pattern).

---

#### 2. HTTP response contract for cap-reached and idempotency is underspecified
**Spec reference:** Story 3 AC#4 (line 25): "return `200 { suggestions: [], capReached: true }` with an explanatory `reason` field"

**Current state:**
- Spec explicitly says return 200 + `capReached: true` flag (not 429) — correct for graceful degradation.
- No spec section defining HTTP codes for:
  - Successful suggestions generated (200? 201?)
  - Inquiry/schema not found (404 implied)
  - Invalid context payload (400 implied)
  - LLM timeout or API failure (200 with `llmFallback: true` or 500?)
  - Authorization denied (403 expected)
  - **Duplicate request within a time window** (208 Already Reported per RFC 7231? or just 200 + cache?)

**Risk:**
- Frontend cannot reliably distinguish "no suggestions available" from "cap reached" from "LLM failed" — all return 200.
- Monitoring cannot alert on LLM failures unless `llmFallback` flag is reliably set.
- Idempotency: spec does not say whether a second suggest call within seconds should deduplicate or re-run the LLM. Frontend will not know if a duplicate call is safe.

**Recommended fix:**
Add an "API Contract" subsection to the spec:

| Scenario | Code | Body |
|----------|------|------|
| Suggestions generated | 200 | `{ suggestions: [...], model, costInr, generatedAt }` |
| Cap reached before LLM | 200 | `{ suggestions: [], capReached: true, reason: "daily_limit_exceeded", generatedAt }` |
| Schema not registered | 404 | `{ error: "Config type not found" }` |
| Invalid context payload | 400 | `{ error: "Invalid context shape" }` |
| LLM timeout or API error (fallback) | 200 | `{ suggestions: [], llmFallback: true, reason: "llm_unavailable", generatedAt }` |
| Unauthorized (no platform:update) | 403 | `{ error: "Access denied" }` |
| Idempotent duplicate (same context within 60s) | 200 | `{ suggestions: [...], isDuplicate: true, originalRequestAt, generatedAt }` (optional; or just re-run) |

**Code location:** Route controller (`backend/src/modules/platform/config-controller.ts`), validation schema, and frontend service error handling.

---

#### 3. Audit lineage for AI-suggested configs is incomplete (changes field undefined)
**Spec reference:** Story 2 AC#5 (line 38): "audit `changes` array includes a `source: 'ai'` marker on those fields"

**Current state:**
- `backend/src/shared/types.ts` defines `FieldChange` as: `{ field, displayName, oldValue, newValue }` (lines 61–66).
- **No `source` field** in the FieldChange interface. Adding it requires:
  1. Extend `FieldChange` type to include `source?: 'ui' | 'ai' | 'import'`.
  2. Update audit log schema to allow the new field.
  3. Spec says the upsert handler **must** include the marker when writing a config entry that incorporates AI suggestions.

**Risk:**
- Audit trail will not record which fields were AI-suggested vs. manually entered by the admin.
- Compliance/forensics: cannot trace "admin accepted this AI suggestion and saved it" vs. "admin ignored the suggestion and hand-typed a value."
- Future learning loops (story 4 of the discovery) cannot distinguish human-approved suggestions.

**Recommended fix:**
1. **Extend `FieldChange` type** in `backend/src/shared/types.ts`:
   ```typescript
   export interface FieldChange {
     field: string;
     displayName: string;
     oldValue: any;
     newValue: any;
     source?: 'ui' | 'ai' | 'import';  // new optional field
   }
   ```

2. **Update audit log schema** (`backend/src/shared/audit.ts`, line 42):
   ```typescript
   changes: [{ field: String, displayName: String, oldValue: Schema.Types.Mixed, newValue: Schema.Types.Mixed, source: String }],
   ```

3. **In config-service upsert handler:** When persisting a config entry, loop through the submitted `values` and check if each field was accepted from a `ConfigSuggestion` doc (matched by `field` + `configType`). If yes, add `source: 'ai'` to the corresponding change entry.

**Code location:**
- Types: `backend/src/shared/types.ts` (extend FieldChange).
- Audit schema: `backend/src/shared/audit.ts` (update the Mongoose field).
- Service: `backend/src/modules/platform/config-service.ts` (upsert handler, check suggestion acceptance).

---

### 🟡 MEDIUM

#### 4. Sensitive-field filtering must run BEFORE LLM payload assembly (defense-in-depth)
**Spec reference:** Story 4 AC#2 (line 57): "filter out any field where the registry sets `aiSuggestable: false` BEFORE building the LLM prompt"

**Current state:**
- Spec correctly identifies the risk: if `aiSuggestable: false` fields are passed to the LLM context and then stripped from the response, the value still leaked to the external API.
- **Pattern is sound — filter before LLM.** Recommend:
  1. Load the registered schema for `configType` from `config-registry.ts`.
  2. Check `schema.fields[fieldName].aiSuggestable` (defaults to `true` per AC#1).
  3. Drop fields where `aiSuggestable === false` from the context **before** building the prompt.

**Risk if deviates:**
- Secrets or credentials in a future config type could leak to Claude API if filtering is post-LLM.

**Recommended fix:**
In the config-suggestion service, before building the LLM prompt:
```typescript
const registry = getConfigRegistry();
const schema = registry.schemas[configType];
const allowedFields = Object.keys(currentValues || {}).filter(
  field => schema.fields[field]?.aiSuggestable !== false
);
const filteredContext = {
  collegeProfile: maskedProfile,
  currentValues: Object.fromEntries(allowedFields.map(f => [f, currentValues[f]])),
};
```

**Code location:** `backend/src/modules/platform/config-suggestion/service.ts` (new, config-suggestion service).

---

#### 5. PII masker reusability — confirm context shapes match
**Spec reference:** Story 1 AC#1 (line 22): "The call is cap-guarded... runs an LLM call, and returns `{ suggestions, model, costInr, generatedAt }`"

**Current state:**
- `backend/src/shared/llm/pii.ts` (lines 23–36) defines mask rules for: `phone, email, address, aadhaar, pan, dob` + nested `guardian.*` fields.
- **Spec says college profile + current config values pass through `maskPII`.** Spec does not define what fields are in "college profile."
- **Unknown:** Does the college profile object traverse the same paths (top-level + `guardian.*`) that the masker expects?

**Risk:**
- If the college profile includes unrecognized sensitive fields (e.g., `finance.accountNumber`, `principal.phone`), the masker won't catch them.
- PII could leak to the LLM if the context shape doesn't match the masker's assumptions.

**Recommended fix:**
1. **Spec clarification:** Define "college profile" shape — recommend including: `name, code, location, yearFounded, studentCount, accreditation` (no student/principal PII).
2. **In service:** Before calling `maskPII`, document exactly what context shape is sent:
   ```typescript
   const collegeProfile = {
     name: college.name,                    // not PII
     code: college.code,                    // not PII
     location: college.location,            // not PII
     yearFounded: college.yearFounded,      // not PII
     studentCount: college.studentCount,    // not PII
   };
   // No phone, email, guardian fields — safe to mask
   const { masked, tokenMap } = maskPII({ collegeProfile, currentValues });
   ```
3. **Test:** Unit test confirms no unmasked PII escapes `maskPII()` in the suggest context.

**Code location:** `backend/src/modules/platform/config-suggestion/service.ts` (service implementation + comments), and unit tests.

---

#### 6. Stats endpoint multi-tenancy must verify collegeId filter in aggregation pipeline
**Spec reference:** Story 3 AC#1 (line 48): "`GET /config/suggestions/stats?range=today|week|month` returns aggregated stats"

**Current state:**
- Spec says "Stats are aggregated from `ConfigSuggestion` documents — no separate stats model needed."
- **Pattern risk:** If the aggregation pipeline does not filter by `collegeId` early (first stage), a malicious user could query with a spoofed `collegeId` header and leak peer colleges' suggestion counts.
- Reference 001-ai-lead-scoring gate2 confirms: "Stats endpoint scoping: `GET /lead-scoring/stats?range=today` must aggregate by `collegeId`" (line 240).

**Risk:**
- Cross-tenant data leak if aggregation is not properly scoped.

**Recommended fix:**
In the stats handler, verify the aggregation pipeline:
```typescript
const stats = await ConfigSuggestion.aggregate([
  { $match: { collegeId: new ObjectId(collegeId), generatedAt: { $gte: startDate, $lt: endDate } } },  // FIRST STAGE
  { $group: {
    _id: '$configType',
    totalSuggested: { $sum: 1 },
    accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
    rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
    llmCostInr: { $sum: '$costInr' },
  } },
]);
```
**Code location:** `backend/src/modules/platform/config-controller.ts` (stats handler, `suggestionsStats` function).

---

## Confirmed ✅

✅ **Routes conflict-free:** Proposed routes (`POST /api/platform/config/:type/suggest`, `GET /api/platform/config/suggestions/stats`) do not exist in `backend/src/modules/platform/routes.ts` (lines 141–186 cover `/config/types`, `/config/:type/schema`, `/config/:type`, `/config/:type/:identifier`). No naming collisions.

✅ **Authorization pattern:** Spec says `authorize('platform', 'update')` for suggest and `authorize('platform', 'read')` for stats. Verified in `routes.ts` (lines 141–175): `authorize('platform', 'read')` and `authorize('platform', 'update')` are the correct calls. **No RBAC role issues** (unlike 001-ai-lead-scoring, which had an undefined role).

✅ **Multi-tenancy:** `authenticate` middleware extracts `collegeId` (required on every request). Spec requires all `ConfigSuggestion` docs carry `collegeId` and filtering. Standard pattern, sound.

✅ **Cap-guard pattern reusable:** `backend/src/modules/admissions/lead-scoring/cap-guard.ts` is a self-contained utility with no admissions-specific dependencies. Safe to copy verbatim with new Redis key namespace.

✅ **Audit infrastructure ready:** `backend/src/shared/audit.ts` defines `createAuditLog()` and `AuditAction`. New actions `ai_config_suggested` and `ai_config_applied` can be added to the enum (line 32). The enum mirrors `AuditAction` type in `shared/types.ts` (line 26–48).

✅ **Validation pattern:** Zod schemas will be added to `backend/src/modules/platform/validation.ts`. Existing patterns validate required fields, enums, ranges. No special risk.

✅ **PII masker exists and is reusable:** `backend/src/shared/llm/pii.ts` has no admissions/finance-specific imports. Safe for config-suggestion service to use (requires context shape alignment, flagged in Finding #5).

✅ **Config registry exists:** `backend/src/modules/platform/config-registry.ts` defines the 4 initial schemas. Future configs can add `aiSuggestable: false` per field.

✅ **Error handling pattern:** `AppError(statusCode, message)` is enforced (CLAUDE.md). Responses follow 404 for not found, 400 for bad input, 403 for authorization failure — standard.

---

## Recommendations for Implementer (Phase 8)

### Immediate (before coding):
1. Finalize HTTP contract section (Finding #2) — define exact response codes and flags for all scenarios.
2. Copy cap-guard pattern from `admissions/lead-scoring/cap-guard.ts` as-is (Finding #1).
3. Extend `FieldChange` type to include optional `source` field (Finding #3).

### During implementation:
4. Implement sensitive-field filtering BEFORE LLM context assembly (Finding #4).
5. Document college profile shape in code + test (Finding #5).
6. Verify stats aggregation pipeline filters by `collegeId` as first stage (Finding #6).

### Post-implementation (before GATE 3):
7. Unit tests for cap-guard atomicity (concurrent requests).
8. Integration tests for PII masking in suggest context.
9. Security test: verify `aiSuggestable: false` fields never reach the LLM.

---

## Sign-off

**Validator:** API + Security lead  
**Date:** 2026-05-14  
**Status:** PASS — Ready for Phase 8. Six findings address edge cases and multi-tenancy confirmation; no blockers to implementation.
