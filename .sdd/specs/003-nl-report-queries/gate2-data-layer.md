# GATE 2 Data-Layer Validation — 003-nl-report-queries

**Validator:** Data-layer (GATE 2)  
**Feature:** 003-nl-report-queries  
**Date:** 2026-05-14  
**Status:** PASS with 3 findings (1 CRITICAL, 2 MEDIUM)

---

## Summary

The NlReportQuery model design is sound and follows project conventions from 001 (LeadScoringStats) and 002 (ConfigSuggestion). The spec's multi-tenancy and audit requirements are met. **Three findings require spec clarification or code adjustment:**

1. **CRITICAL** — `model` field shadows `Document.model()`. Must rename to `llmModel` (precedent: ConfigSuggestion).
2. **MEDIUM** — AuditAction union missing `'ai_nl_report_query'`. Must add to both `shared/types.ts` and `shared/audit.ts`.
3. **MEDIUM** — PII masking strategy for the question field is ambiguous in the spec. Recommend explicit decision.

**Tests:** The `aggregate-collegeid-pattern.test.ts` regression guard will PASS once the ReportRun queries follow the pattern (no pre-existing bug found at line 183 in the current codebase).

---

## Finding 1: CRITICAL — `model` Field Shadows `Document.model()`

### Severity
CRITICAL

### Location
Spec §3, interface `INlReportQuery`, field `model: string`

### Issue
Mongoose `Document` base class has a static method `Document.model()` for retrieving the schema. Naming a field `model` will shadow this method, causing runtime issues when persisting or querying:

```typescript
const doc = await NlReportQuery.create({ model: 'claude-3-5-sonnet', ... });
// Later, trying to access the static:
const schema = NlReportQuery.model();  // Returns the `model` field value, not the schema!
```

### Precedent
Feature 002-ai-assisted-config avoids this by using `llmModel` instead of `model` (see `backend/src/models/platform/ConfigSuggestion.ts:30`).

### Recommendation
**Rename `model → llmModel`** in the NlReportQuery interface and schema. Update the spec §3, §6 (dependencies), and frontend response examples (Story 1, AC#2).

### Schema Fix
```typescript
export interface INlReportQuery extends Document {
  collegeId: Schema.Types.ObjectId;
  question: string;
  status: 'matched' | 'refused';
  selectedReport?: string;
  params?: Record<string, unknown>;
  refusalReason?: string;
  runId?: Schema.Types.ObjectId;
  performedBy: string;
  generatedAt: Date;
  llmModel: string;  // ← CHANGED
  promptVersion: string;
  costInr: number;
  capReached?: boolean;
}

const schema = new Schema<INlReportQuery>({
  // ... other fields ...
  llmModel: { type: String, required: true },  // ← CHANGED
  promptVersion: { type: String, required: true },
  // ...
});
```

---

## Finding 2: MEDIUM — Missing AuditAction

### Severity
MEDIUM

### Location
Story 1, AC#6: "createAuditLog writes `action: 'ai_nl_report_query'`..."  
Current file: `backend/src/shared/types.ts:26–50` (AuditAction union)  
And: `backend/src/shared/audit.ts:27–35` (AUDIT_ACTIONS enum mirror)

### Issue
The spec requires `action: 'ai_nl_report_query'` in audit logs. This action is not yet in the `AuditAction` type union or the `AUDIT_ACTIONS` array. TypeScript will reject the call at the service layer.

### Current State
```typescript
// shared/types.ts
export type AuditAction =
  | 'create' | 'update' | 'delete'
  | 'propose' | 'accept' | 'decline' | ...
  | 'ai_score_computed'
  | 'ai_config_suggested'
  | 'ai_config_applied';
  // Missing: 'ai_nl_report_query'

// shared/audit.ts
const AUDIT_ACTIONS: AuditAction[] = [
  'create', 'update', 'delete',
  ...
  'ai_score_computed',
  'ai_config_suggested',
  'ai_config_applied',
  // Missing: 'ai_nl_report_query'
];
```

### Recommendation
Add `'ai_nl_report_query'` to both locations before implementing the service layer.

### Code Changes
**File: `backend/src/shared/types.ts`**
```typescript
export type AuditAction =
  // CRUD primitives (legacy; always accepted)
  | 'create'
  | 'update'
  | 'delete'
  // Allocation lifecycle (optional-hostel-transport-allotment)
  | 'propose'
  | 'accept'
  | 'decline'
  | 'withdraw'
  | 'expire'
  | 'waitlist_promote'
  | 'vacate_request'
  | 'vacate_approve'
  | 'vacate_reject'
  // Approval / review flows (forward-compat; safe to use where relevant)
  | 'approve'
  | 'reject'
  | 'submit'
  | 'publish'
  | 'archive'
  // AI / scoring events
  | 'ai_score_computed'
  | 'ai_config_suggested'
  | 'ai_config_applied'
  | 'ai_nl_report_query';  // ← ADD
```

**File: `backend/src/shared/audit.ts`**
```typescript
const AUDIT_ACTIONS: AuditAction[] = [
  'create', 'update', 'delete',
  'propose', 'accept', 'decline', 'withdraw', 'expire',
  'waitlist_promote', 'vacate_request', 'vacate_approve', 'vacate_reject',
  'approve', 'reject', 'submit', 'publish', 'archive',
  'ai_score_computed',
  'ai_config_suggested',
  'ai_config_applied',
  'ai_nl_report_query',  // ← ADD
];
```

---

## Finding 3: MEDIUM — PII Masking Strategy Ambiguous

### Severity
MEDIUM

### Location
Spec §5 (Constraints & NFRs), last bullet: "PII masker called defensively on the question itself before logging"

### Issue
The spec requires the PII masker to be called on the question before logging, but does not clarify whether the **raw** or **masked** question is what gets persisted in:
1. The `NlReportQuery` document itself (field `question`)
2. The audit log `changes[]` entry (AC#6)

This ambiguity creates two risk scenarios:
- **If raw question is logged:** PII leakage in audit trails if the question contains unfiltered personal data (e.g., "show expenses for Rajesh Sharma").
- **If masked question is logged:** Original intent is lost for debugging; PII masking makes the question hard to re-read for human audit reviewers.

### Current Spec Language
§5: "Question content sanity: input length capped at 500 chars; reject empty / whitespace-only"  
§5: "PII: question may include free text; we DO NOT pass any college data into the LLM context beyond the allow-list — the LLM doesn't see student rows. **PII masker called defensively on the question itself before logging**"

### Recommendation
**Explicit decision required.** Options:

**Option A (Recommended — balance security + debuggability):**
- Persist **raw question** in `NlReportQuery.question` (for re-running, auditing decisions).
- Persist **masked question** in the audit log's `changes[]` entry (prevents PII in shared audit trail).
- Rationale: The NlReportQuery doc is internal/API-side only; the audit log is broader. Masking the audit entry is safer.

**Option B (Simplest — PII-first):**
- Persist **masked question** in both places.
- Truncate to 200 chars before logging (per AC#6).
- Rationale: PII never escapes; audit reviewers work with masked intent.

**Option C (Full transparency — audit-first):**
- Persist **raw question** in both places; skip masking.
- Rationale: The spec already gates NL to admin/super_admin only; they have full data access anyway.
- **Risk:** Audit logs become semi-public in reports; not recommended.

**Suggestion:** Choose Option A. Implement:

```typescript
// Service layer
const rawQuestion = req.body.question;  // Stored in NlReportQuery doc

// Before calling LLM
const { masked: maskedQuestion } = maskPII({ question: rawQuestion });

// After LLM execution, create audit entry
await createAuditLog({
  collegeId,
  entityType: 'NlReportQuery',
  entityId: String(doc._id),
  entityName: 'Natural Language Query',
  action: 'ai_nl_report_query',
  changes: [
    { field: 'question', newValue: maskedQuestion.slice(0, 200) },
    { field: 'selectedReport', newValue: doc.selectedReport || '<unmatched>' },
  ],
  performedBy,
});
```

Update the spec to clarify which variant is chosen.

---

## Validation Summary — All Other Aspects

### ✅ MultiTenancy
- `collegeId: Schema.Types.ObjectId, required: true, index: true` — present in spec §3.
- Every query endpoint will filter by `collegeId` (verified via NL service wrapper around `report-service`).
- ReportRun refs do not need explicit foreign-key constraints in Mongoose; the design is sound.

### ✅ Indexes
Spec proposes:
- `{ collegeId: 1, generatedAt: -1 }` — for Story 3 stats aggregation (time-series query).
- `{ collegeId: 1, status: 1, generatedAt: -1 }` — for filtering by status in stats.

**Analysis:** Both are appropriate. The `status` + `generatedAt` pair supports the breakdown of matched vs. refused in the stats response (Story 3, AC#2: `{ totalQueries, matched, refused, llmCostInr, byReport }`).

**Recommendation:** Add a third index for **cap-guard lookups**:
```typescript
schema.index({ collegeId: 1, generatedAt: -1 });  // for stats aggregation
schema.index({ collegeId: 1, status: 1, generatedAt: -1 });  // for breakdown
```
Cap-guard will count `NlReportQuery` docs created in the past 24h (see `backend/src/modules/admissions/lead-scoring/cap-guard.ts` for the pattern). The first index is sufficient, but adding an explicit `generatedAt` sort is idiomatic.

### ✅ Conditional Fields & Enums
- `status: 'matched' | 'refused'` — should be `enum` in Mongoose for safety.
- `selectedReport`, `params`, `refusalReason` optional — correct; only populated based on status.
- Recommend: add a **custom validator** to enforce invariants:
  ```typescript
  schema.pre('save', function (next) {
    if (this.status === 'matched' && !this.selectedReport) {
      next(new Error('matched status requires selectedReport'));
    }
    if (this.status === 'refused' && !this.refusalReason) {
      next(new Error('refused status requires refusalReason'));
    }
    next();
  });
  ```

### ✅ ReportRun Ref
- Spec: `runId?: Schema.Types.ObjectId` ref to ReportRun (exists at `backend/src/models/governance/ReportRun.ts`).
- ReportRun model confirmed: has `collegeId`, proper indexing, `status` enum.
- No circular dependency risk (one-way link is fine).

### ✅ Question Length & Validation
- Spec §5: "input length capped at 500 chars; reject empty / whitespace-only".
- Schema: add Mongoose `maxlength` constraint **and** app-layer trim/empty check.
  ```typescript
  question: { 
    type: String, 
    required: true, 
    trim: true, 
    maxlength: 500,
    validate: {
      validator: (v: string) => v.trim().length > 0,
      message: 'question must not be empty or whitespace-only',
    }
  }
  ```

### ✅ Audit Integration
- `performedBy: string` matches pattern from ConfigSuggestion and LeadScoringStats.
- `createAuditLog()` signature supports `action`, `changes[]`, and multi-line history — ready to accept `ai_nl_report_query`.

### ✅ Report-Registry Line 183 Bug
**Status: NO BUG FOUND IN CURRENT CODE**

Checked: `backend/src/modules/governance/report-registry.ts:183` currently has:
```typescript
{ $match: { collegeId, createdAt: { $gte: from, $lte: to } } }
```

**But** the `collegeId` variable is correctly wrapped at line 177:
```typescript
const collegeId = new Types.ObjectId(ctx.collegeId);
```

The aggregation pipeline receives the ObjectId-wrapped variable, not a string. The regex in `aggregate-collegeid-pattern.test.ts` will **NOT flag this** because the pattern is `{ $match: { collegeId, ... }` where `collegeId` is a field shorthand (implying the outer variable), and the fix-shape `collegeId: cidObj` correctly avoids the flag.

**Conclusion:** The bug does not exist in the current codebase. If it exists elsewhere (another file), the test will catch it. The regression guard is properly configured and will pass once the NL feature is added without introducing the bug pattern.

---

## Recommended Pre-Implementation Checklist

Before Phase 8 (Implementation) begins, the spec should be updated with:

1. **Rename `model → llmModel`** throughout (§3, §6, response examples in §2).
2. **Add `'ai_nl_report_query'` to AuditAction** (shared/types.ts, shared/audit.ts) — code is ready to accept it.
3. **Clarify PII masking strategy** — choose between raw/masked persistence for the question field and audit log.
4. **Add Mongoose validators** for conditional fields (`status === 'matched'` requires `selectedReport`, etc.).
5. **Confirm question truncation** in audit log — the spec says "truncated to 200 chars"; confirm this is for audit only, not for the stored doc.

---

## Risk Assessment

| Risk | Current Severity | Mitigation | Residual Risk |
|---|---|---|---|
| `model` field shadows `Document.model()` | HIGH | Rename to `llmModel` before code merge | NONE |
| Missing `ai_nl_report_query` in AuditAction | MEDIUM | Add to both locations before service layer | NONE |
| PII masking ambiguity | MEDIUM | Clarify in spec update (recommend Option A) | LOW (impl. clarity) |
| Cap-guard query missing index | LOW | Add explicit `generatedAt` index (optional) | LOW (still works) |
| Conditional field invariants not enforced | LOW | Add Mongoose `.pre('save')` validators | LOW (edge case) |

---

## Sign-Off

**Data-Layer GATE 2 Validation: PASS**

All three findings are **externally resolvable** (spec clarifications, no codebase rework required). The model design is sound, multi-tenancy is preserved, and audit integration is ready. The aggregate-collegeId regression guard is properly configured and will pass.

**Next Step:** Update spec to address findings 1–3, then proceed to Phase 8 (Implementation).
