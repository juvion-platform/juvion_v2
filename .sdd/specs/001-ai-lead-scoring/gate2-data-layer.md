# GATE 2 — Data-Layer Validation

## Summary
**FAIL** — 8 findings: critical schema gap (`scoreRationale` missing), audit action enum needs extension, debounce tracking field missing, interaction causation field missing, insufficient indexes for score-based queries, cost-tracking entity unclear, existing field nullability risk, and migration backfill consideration.

---

## Findings

### 🔴 CRITICAL

#### 1. `scoreRationale` field not in Inquiry schema
**Spec reference:** §3 "Rationale storage" (lines 96–109)
**Current state:** `backend/src/models/admissions/Inquiry.ts` has no `scoreRationale` field (lines 1–192).
**Risk:** Without this field, the entire audit trail of scoring decisions is lost; UI cannot display factor breakdowns (Story 4, line 54–58).
**Recommended fix:**
Add to `IInquiry` interface (after `interactionCount`):
```typescript
scoreRationale?: {
  ruleScore: number;
  llmScore: number | null;
  blendedScore: number;
  factors: Array<{ label: string; weight: number; source: 'rule' | 'llm' }>;
  lastInteractionInfluence?: { factor: string; shift: number };
  llmSkipped?: boolean;
  llmFallback?: boolean;
  llmCostInr?: number;
  computedAt: Date;
  modelVersion: string;
};
```
Add to schema (after `interactionCount: { type: Number, default: 0 }`):
```typescript
scoreRationale: {
  type: {
    ruleScore: Number,
    llmScore: { type: Number, default: null },
    blendedScore: Number,
    factors: [{
      label: String,
      weight: Number,
      source: { type: String, enum: ['rule', 'llm'] }
    }],
    lastInteractionInfluence: {
      factor: String,
      shift: Number
    },
    llmSkipped: { type: Boolean, default: false },
    llmFallback: { type: Boolean, default: false },
    llmCostInr: Number,
    computedAt: Date,
    modelVersion: String
  }
},
```

#### 2. Audit action `'ai_score_computed'` not in AuditAction enum
**Spec reference:** Story 1, line 25 "action: 'ai_score_computed'"
**Current state:** `backend/src/shared/types.ts` (line 26–46) and `backend/src/shared/audit.ts` (line 27–32) define a fixed set of actions; `'ai_score_computed'` is not in the union.
**Risk:** Attempting to log with this action will fail at runtime or be rejected by validation.
**Recommended fix:**
Add `'ai_score_computed'` to the AuditAction type in `shared/types.ts`:
```typescript
export type AuditAction =
  // ... existing actions ...
  | 'ai_score_computed'   // Lead scoring compute event
  // ...
```
Update the AUDIT_ACTIONS array in `backend/src/shared/audit.ts`:
```typescript
const AUDIT_ACTIONS: AuditAction[] = [
  'create', 'update', 'delete',
  'propose', 'accept', 'decline', 'withdraw', 'expire',
  'waitlist_promote', 'vacate_request', 'vacate_approve', 'vacate_reject',
  'approve', 'reject', 'submit', 'publish', 'archive',
  'ai_score_computed',  // Lead scoring
];
```

#### 3. Missing `lastScoredAt` field for debounce enforcement
**Spec reference:** Story 2, line 35 "max 1 rescore per 5 minutes per inquiry"
**Current state:** `Inquiry` schema has `lastInteractionAt` (line 144) but no `lastScoredAt` to track when the score computation last occurred.
**Risk:** Without this field, the 5-minute debounce window cannot be enforced; service code will need ad-hoc workarounds (e.g., checking `scoreRationale.computedAt`, which is buried inside a nested object and not indexed).
**Recommended fix:**
Add to `IInquiry` interface:
```typescript
lastScoredAt?: Date;
```
Add to schema:
```typescript
lastScoredAt: { type: Date, index: true },
```

### 🟠 HIGH

#### 4. Missing index on `leadScore` for sorting/filtering
**Spec reference:** Story 4, line 56 "Sortable by leadScore desc"; line 57 filter by grade
**Current state:** `Inquiry` schema (lines 182–190) has indexes on `collegeId`, `status`, `phone`, `assignedOfficerId`, `mqlSqlClassification`, `utmCampaign`, but not on `leadScore`.
**Risk:** Dashboard queries sorting by `leadScore` desc or filtering by `leadGrade` will perform collection scans on large inquiry bases (hundreds of thousands per college).
**Recommended fix:**
Add to schema after line 190:
```typescript
schema.index({ collegeId: 1, leadScore: -1 });
schema.index({ collegeId: 1, leadGrade: 1, leadScore: -1 });
schema.index({ collegeId: 1, lastScoredAt: -1 });  // for debounce lookup
```

#### 5. No schema for LLMUsageSnapshot / cost-tracking entity
**Spec reference:** Story 5, line 67 "llmCostInr, avgLatencyMs, gradeDistribution"; line 69 "yellow banner" when cap hit
**Current state:** No mention of an aggregated daily-stats model in the codebase. Spec references retrieving stats but doesn't define a persistent entity for daily snapshots.
**Risk:** Stats endpoint will need ad-hoc aggregation from audit logs or scoreRationale fields, which is expensive and fragile. If you need historical trending (day-over-day cost, LLM vs rules ratio), you'll have no data.
**Recommended fix:**
Create `backend/src/models/admissions/LeadScoringStats.ts`:
```typescript
export interface ILeadScoringStats extends Document {
  collegeId: Schema.Types.ObjectId;
  date: Date;  // daily bucket (start of day UTC)
  totalScored: number;
  llmScored: number;
  rulesOnlyScored: number;
  totalLlmCostInr: number;
  avgLatencyMs: number;
  gradeDistribution: { hot: number; warm: number; cold: number; dormant: number };
  llmCapHit: boolean;  // did we hit the daily cap?
  modelVersion: string;
}

const schema = new Schema<ILeadScoringStats>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  date: { type: Date, required: true, index: true },  // start of day
  totalScored: { type: Number, default: 0 },
  llmScored: { type: Number, default: 0 },
  rulesOnlyScored: { type: Number, default: 0 },
  totalLlmCostInr: { type: Number, default: 0 },
  avgLatencyMs: { type: Number, default: 0 },
  gradeDistribution: {
    hot: { type: Number, default: 0 },
    warm: { type: Number, default: 0 },
    cold: { type: Number, default: 0 },
    dormant: { type: Number, default: 0 }
  },
  llmCapHit: { type: Boolean, default: false },
  modelVersion: String,
}, { timestamps: true });

schema.index({ collegeId: 1, date: -1 });

export const LeadScoringStats = model<ILeadScoringStats>('LeadScoringStats', schema);
```

#### 6. Existing `leadScore` and `leadGrade` will be `undefined` for pre-existing inquiries
**Spec reference:** Acceptance criterion, line 3–4 "Inquiry doc is updated with leadScore (0–100), leadGrade..."
**Current state:** `Inquiry.ts` line 137–142 defines `leadScore?: number` and `leadGrade?: string` as optional. Millions of existing inquiries in production DBs will have these as undefined.
**Risk:** When the scoring service launches, existing inquiries appear unscored in the UI (grade badge missing, sort order undefined). Officers will see mixed scored/unscored inquiries. Batch backfill (Story 3) is essential but may be slow on large collections.
**Recommended fix (not a schema change, but necessary ops task):**
- Document a migration script to backfill all existing inquiries with `leadScore: 0, leadGrade: 'dormant'` to establish a baseline.
- Enqueue a batch rescore job for all inquiries on feature launch (using Story 3, line 45–46).
- Mention this in deployment runbook.

### 🟡 MEDIUM

#### 7. LeadInteraction model missing trigger-causation tracking
**Spec reference:** Story 2, line 34 "a re-score job is enqueued" when interaction outcome is positive
**Current state:** `LeadInteraction` model (backend/src/models/admissions/LeadInteraction.ts, lines 1–44) has no field linking a re-score job back to the interaction that triggered it.
**Risk:** Audit/observability gap: you cannot trace "which interaction caused this score update?" from the audit log alone. Makes debugging scoring behavior harder.
**Recommended fix (optional; nice-to-have):**
Add to `ILeadInteraction`:
```typescript
triggeringScoringJobId?: string;  // BullMQ jobId if this interaction triggered a rescore
```
Add to schema:
```typescript
triggeringScoringJobId: String,
```
After scoring completes, service writes this back to the interaction so the relationship is bidirectional.

#### 8. Service signature clarity — `scoreRationale` as part of update payload or computed inside?
**Spec reference:** §3 Scoring Model, lines 71–109 (entire rationale shape)
**Current state:** Not yet a blocking issue, but service design ambiguity: when a scoring job updates the Inquiry, does the controller/service receive `scoreRationale` in the request body, or does the worker compute it entirely inside the scoring service?
**Recommendation:** Per Juvion conventions (CLAUDE.md), the service layer should compute and return the rationale. Controller should not accept it in input. Clarify this in the service method signature:
```typescript
export async function scoreInquiry(collegeId: string, inquiryId: string, performedBy: string): Promise<{ inquiry: IInquiry; rationale: ScoreRationale }> {
  // worker logic: compute ruleScore, llmScore, blend, build rationale
  // update Inquiry with leadScore, leadGrade, scoreRationale
  // call createAuditLog with action: 'ai_score_computed'
  // return updated doc
}
```

---

## Confirmed

✅ **Inquiry model exists** with `collegeId` (line 66), multi-tenancy baked in  
✅ **LeadInteraction model** supports interaction history with outcomes (lines 30–34)  
✅ **`deriveLeadGrade()` function** is production-ready in workflow.handlers.ts (line 2654–2659)  
✅ **W01 workflow handler** expects `leadScore`/`leadGrade` in result (lines 66–84)  
✅ **BullMQ queue** `LEAD_SCORING` is reserved (QueueManager.ts line 109)  
✅ **LLM client** with cost tracking exists (juvi/finance-agent/llm-client.ts)  
✅ **Audit infrastructure** is in place; just needs action type extension  
✅ **AssignmentRule** can route on `leadScore`/`leadGrade` operators (discovery.md line 14)  

---

## Conclusion

The data layer has a **solid foundation** — Inquiry, LeadInteraction, workflow, queue, and LLM client are all ready. The feature is **blockedby schema gaps**: 
1. Add `scoreRationale` (CRITICAL)
2. Add `lastScoredAt` (CRITICAL)
3. Extend `AuditAction` to include `'ai_score_computed'` (CRITICAL)
4. Add cost-tracking entity and stats aggregation (HIGH)
5. Add missing indexes on `leadScore`, `leadGrade`, `lastScoredAt` (HIGH)
6. Plan migration/backfill for existing inquiries (HIGH)

**Blockers resolved → Proceed to Phase 8 (implementation).**
