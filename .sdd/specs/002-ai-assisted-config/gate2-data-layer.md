# GATE 2 Data-Layer Validation — 002-ai-assisted-config

**Validator:** Data-Layer (Gate 2)  
**Spec:** `/Users/srinivasarao.kandula/code/juvion_v2/.sdd/specs/002-ai-assisted-config/spec.md`  
**Date:** 2026-05-14  
**Status:** PASS (8 findings: 0 blockers, 4 warnings, 4 confirms)

---

## Summary

The spec's data-layer design is sound and architecturally consistent with existing patterns (lead-scoring, config-registry). **All critical multi-tenancy, audit, and index requirements are satisfied.** Three minor enhancements are recommended:

1. **`ConfigSuggestion.source` should have an enum constraint** — currently implicit as `'llm' | 'peer-default'`; should be explicit in Mongoose.
2. **`FieldChange` does not support arbitrary metadata** — the spec's `source: 'ai'` marker needs a schema extension to persist which fields came from AI.
3. **`aiSuggestable` flag placement in `ConfigField` is correct** — forward-compatible and defensive.

The decision to aggregate stats from `ConfigSuggestion` documents (no separate stats model) is **justified and validated** — volumes are low (50/day/college) and daily aggregation via direct counts is cheaper than a `LeadScoringStats`-style upsert model.

---

## Findings by Severity

### BLOCKERS: 0

All required fields, types, indexes, and multi-tenancy guards are present or straightforward to add.

---

### WARNINGS (recommend fixes before GATE 3)

#### 1. **`ConfigSuggestion.source` field — type safety**
- **Finding:** Spec defines `source: 'llm' | 'peer-default'` in the interface, but no Mongoose enum constraint is proposed.
- **Risk:** Future refactors or concurrent peer-default logic could introduce typos (`'llm-default'`, `'llm_peer'`).
- **Why:** Lead-scoring uses explicit enums for similar discriminators (see `ScoreRationale.factors[].source: 'rule' | 'llm'` as a model).
- **How to apply:** Add `source: { type: String, enum: ['llm', 'peer-default'], required: true }` to the schema. No downstream impact — the spec is already strict.

#### 2. **Audit `changes` array cannot record `source: 'ai'` metadata directly**
- **Finding:** Story 2 AC 5 says "audit `changes` array includes a `source: 'ai'` marker on those fields". The `FieldChange` interface (shared/types.ts:61–66) has four fields: `field`, `displayName`, `oldValue`, `newValue`. No metadata column.
- **Example case:** When admin saves a config entry with an accepted AI suggestion, the audit log should indicate *which* fields came from AI and which were manual. Today's schema cannot express this.
- **Current workaround:** Store a parallel `ai_config_applied` audit entry with a custom payload—but this is lossy (the `upsertConfigEntry` audit entry loses the lineage).
- **Why:** Config audits may be read 12+ months later for compliance; the source-of-origin per-field is valuable context.
- **Recommendation:** Extend `FieldChange` with an optional `metadata?: { source?: 'ai' | 'manual' }` (or union `source` field). Then:
  ```typescript
  export interface FieldChange {
    field: string;
    displayName: string;
    oldValue: any;
    newValue: any;
    metadata?: { source?: 'ai' | 'manual'; [key: string]: any };  // forward-compat
  }
  ```
  Mongoose schema `changes` subdoc gains `metadata: Schema.Types.Mixed`.
- **Impact:** Backward-compatible (optional). No existing audits break; new AI-config audits gain lineage.
- **Defer-ability:** Can defer to Phase B if Phase A keeps both `upsertConfigEntry` + `ai_config_applied` entries for now (audit-trail length increase is acceptable for 50 suggestions/day).

#### 3. **Per-suggestion cost fractions must sum to batch cost**
- **Finding:** Spec §3 says `costInr: number` = "share of the batch cost". The spec promises that costs are tracked per-suggestion but does not specify how per-suggestion fractions are computed or validated.
- **Current practice:** Lead-scoring tracks `totalLlmCostInr` per batch via the LLM client's response (single cost figure for the entire scored inquiry). No per-suggestion breakdown.
- **Question:** When POST `/suggest` returns `[suggestion1, suggestion2, ..., suggestionN]` with individual `costInr` values, how is the batch cost divided?
- **Options:**
  - **A (Recommended):** Store a single batch cost on a `batchId` grouper document; compute per-suggestion cost as `batchCost / suggestionCount`. Each suggestion records `batchId` + references the grouper.
  - **B:** Divide the batch cost equally: `costInr = totalBatchCostInr / suggestionCount`.
  - **C:** Track per-suggestion token counts (requires LLM client modification) and pro-rate cost by tokens.
- **Why:** For cost accounting (Story 3) and audit, we need `sum(suggestions[].costInr for a batch) ≈ totalBatchCost` to be provably true.
- **Recommendation:** Adopt **Option B (equal division)** for v1, and add a Mongoose compound index hint in the spec: `{batchId: 1, status: 1}` to allow quick grouping/audit queries.
  - Spec already includes index proposal `{collegeId: 1, configType: 1, generatedAt: -1}` ✓ and `{collegeId: 1, status: 1}` ✓ — good for querying by status. Add `{batchId: 1}` so we can verify batch integrity.

#### 4. **Suggestion expiry cleanup job is deferred but should have a placeholder schema field**
- **Finding:** Spec §7 Risk mitigation says "Optional cleanup job marks `pending` suggestions older than 24h as `expired`" — deferred to Phase B.
- **Schema** already includes `status: 'pending' | 'accepted' | 'rejected' | 'expired'`, so the enum is forward-ready ✓.
- **Recommendation:** Add a note in GATE 3 impl plan that the worker is Phase B; the Phase A data model is ready. No schema change needed.

---

### CONFIRMED (no action required, validates against reference patterns)

#### 1. **`ConfigSuggestion` model matches multi-tenancy requirements**
- ✓ `collegeId: { type: Schema.Types.ObjectId, required: true, index: true }` as first field.
- ✓ All query patterns (Story 2: look up pending suggestions by type; Story 3: aggregate by college + date range) filter by `collegeId` first.
- ✓ Compound indexes `{collegeId: 1, configType: 1, generatedAt: -1}` + `{collegeId: 1, status: 1}` directly support these patterns.

#### 2. **Indexes are well-chosen**
- ✓ `{collegeId: 1, configType: 1, generatedAt: -1}` — used by story 2 (fetch latest pending suggestions for a type) and story 3 time-range aggregations.
- ✓ `{collegeId: 1, status: 1}` — used for daily cap checks (find pending/accepted count for today) and stats queries.
- ✓ Optional `{batchId: 1}` — recommended above for batch-integrity queries.

#### 3. **Aggregation strategy (no separate stats model) is justified**
- **Config suggestions are low-volume:** 50/day/college (vs. lead-scoring's 500/day).
- **Lead-scoring comparison:** Uses a separate `LeadScoringStats` model with daily atomic `$inc` upserts because scoring runs in a worker queue and multiple workers need **atomic daily buckets**. Concurrent $inc on a single doc is the pattern.
- **Config suggestions:** All v1 suggestions are inline (12s max, not queued). A single `POST /suggest` call returns ~5–10 suggestions. **No concurrent writes to the same collegeId+day bucket.** Direct counts via `db.ConfigSuggestion.countDocuments({ collegeId, status, generatedAt: { $gte: startOfDay } })` are fast enough.
- **Recommendation:** Confirmed. The spec is correct to skip `ConfigSuggestionStats` in v1. If Phase B adds async/queued suggestions, revisit.

#### 4. **Audit actions `ai_config_suggested` + `ai_config_applied` are straightforward to add**
- ✓ `AuditAction` union in `shared/types.ts` already includes `ai_score_computed` (from 001-lead-scoring).
- ✓ Adding `'ai_config_suggested' | 'ai_config_applied'` is a single-line change to the union.
- ✓ Mongoose enum in `shared/audit.ts` (line 27–33) also needs the two new actions.
- ✓ No other audit infrastructure changes needed; the controller/service will call `createAuditLog()` with the new actions.

#### 5. **`aiSuggestable: false` flag placement is defensively positioned**
- ✓ Spec proposes adding `aiSuggestable?: boolean` (default `true`) to `ConfigField` interface.
- ✓ Current `ConfigField` structure (config-registry.ts:35–50) has a flat list: `key`, `label`, `type`, `required`, `helpText`, `default`, `options`, `placeholder`.
- ✓ Adding one optional boolean field is a minimal, backward-compatible extension.
- ✓ The suggest endpoint can validate `if (!field.aiSuggestable) { /* skip this field */ }` before building the LLM prompt.
- ✓ Confirmed: no schema conflicts. Forward-compatible for future secret-bearing configs.

#### 6. **Suggestion validation against registered schema is implicit**
- ✓ The spec says (Risk §165) "Validate suggestions against the registered schema before persisting; drop invalid suggestions silently and log a metric".
- ✓ This is not a schema concern but a service concern — confirmed that the existing config-registry patterns (reading `ConfigField[]` and type-checking `suggestedValue` against `field.type`) are already in use in the config-service.
- ✓ The LLM scorer can reuse the same validation logic (e.g., `validateFieldValue(field, suggestedValue)` helper).

---

## Recommended Schema Additions

### 1. ConfigSuggestion Model (new file)

```typescript
// backend/src/models/platform/ConfigSuggestion.ts
import { Schema, model, Document, Types } from 'mongoose';

export interface IConfigSuggestion extends Document {
  collegeId: Types.ObjectId;
  configType: string;
  field: string;                      // dotted path, e.g. "fields.0.minValue"
  suggestedValue: any;                // typed by the registered schema
  confidence: number;                 // 0–1
  rationale: string;                  // one sentence, < 25 words
  source: 'llm' | 'peer-default';
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  generatedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  model: string;                      // e.g. "claude-sonnet-4.6"
  promptVersion: string;              // e.g. "config-advisor-prompt-v1"
  costInr: number;                    // share of batch cost
  batchId: string;                    // groups suggestions from one POST
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IConfigSuggestion>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    configType: { type: String, required: true, trim: true },
    field: { type: String, required: true },
    suggestedValue: { type: Schema.Types.Mixed, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    rationale: { type: String, required: true },
    source: { type: String, enum: ['llm', 'peer-default'], required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'expired'], default: 'pending' },
    generatedAt: { type: Date, required: true, default: Date.now },
    reviewedAt: Date,
    reviewedBy: String,
    rejectionReason: String,
    model: { type: String, required: true },
    promptVersion: { type: String, required: true },
    costInr: { type: Number, required: true, min: 0 },
    batchId: { type: String, required: true, index: true },
  },
  { timestamps: true },
);

// Primary query: fetch pending suggestions for a config type within a time window
schema.index({ collegeId: 1, configType: 1, generatedAt: -1 });

// Daily cap check: count pending/accepted suggestions today
schema.index({ collegeId: 1, status: 1 });

// Batch integrity: sum costs per batch to verify accounting
schema.index({ batchId: 1 });

export const ConfigSuggestion = model<IConfigSuggestion>('ConfigSuggestion', schema);
```

### 2. Extend AuditAction Union

**File:** `backend/src/shared/types.ts` (line 48)

```typescript
export type AuditAction =
  // ... existing actions ...
  | 'ai_score_computed'
  | 'ai_config_suggested'    // NEW: batch suggestion generated
  | 'ai_config_applied';     // NEW: accepted suggestions persisted to config
```

**File:** `backend/src/shared/audit.ts` (line 32–33)

```typescript
const AUDIT_ACTIONS: AuditAction[] = [
  // ... existing ...
  'ai_score_computed',
  'ai_config_suggested',     // NEW
  'ai_config_applied',       // NEW
];
```

### 3. (Optional, Phase A or B) Extend FieldChange for Lineage

**File:** `backend/src/shared/types.ts` (line 61–66)

```typescript
export interface FieldChange {
  field: string;
  displayName: string;
  oldValue: any;
  newValue: any;
  metadata?: { source?: 'ai' | 'manual'; [key: string]: any };
}
```

**File:** `backend/src/shared/audit.ts` (line 42)

```typescript
changes: [
  {
    field: String,
    displayName: String,
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    metadata: Schema.Types.Mixed,  // NEW: forward-compat metadata
  },
],
```

**Deferral:** If Phase A keeps both `upsertConfigEntry` + `ai_config_applied` entries in parallel (no field-level source marker), this can defer to Phase B when bulk audits require the lineage.

### 4. Extend ConfigField for aiSuggestable Flag

**File:** `backend/src/modules/platform/config-registry.ts` (ConfigField interface, line 35–50)

```typescript
export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  required?: boolean;
  helpText?: string;
  default?: unknown;
  options?: ConfigFieldOption[];
  placeholder?: string;
  aiSuggestable?: boolean;  // NEW: default true. set false for credentials/secrets.
}
```

No existing fields need this flag; all four v1 config types are safe to suggest on.

---

## Implementation Checklist (GATE 3)

- [ ] Create `ConfigSuggestion` model with all indexes
- [ ] Extend `AuditAction` + enum in shared/audit.ts
- [ ] Add `aiSuggestable` to `ConfigField` interface
- [ ] Create config-suggest service + LLM integration
- [ ] Create `POST /api/platform/config/:type/suggest` endpoint with cap-guard
- [ ] Create `GET /api/platform/config/suggestions/stats` endpoint
- [ ] Add frontend "Suggest" button + suggestion card UI on SchemaConfigPage
- [ ] Integrate accepted suggestions into `upsertConfigEntry` flow + audit logging
- [ ] Write tests for multi-tenancy (collegeId filtering), cap-guard, JSON validation

---

## Conclusion

**Status: PASS** ✓

The data-layer design is **production-ready**. All multi-tenancy guards are in place. Indexes are well-chosen and directly support the query patterns in the stories. The decision to skip a separate stats model is justified by low volumes and inline execution.

**Recommended before GATE 3:**
1. Add `source` enum constraint to `ConfigSuggestion` (1 line).
2. Confirm cost-fraction strategy (recommend equal division per suggestion).
3. Add batch integrity index `{batchId: 1}` for audit queries.
4. (Optional, Phase B) Extend `FieldChange` for per-field source lineage.

**No blockers. Proceed to implementation.**
