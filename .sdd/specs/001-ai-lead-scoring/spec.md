# Feature Spec — AI Lead Scoring for Admissions Inquiries

**Feature ID:** 001-ai-lead-scoring
**Module:** M01 Admissions
**Owner:** Admissions team
**Status:** Draft (pre-GATE 2)
**Date:** 2026-05-14

## 1. Problem & Motivation

Admissions officers handle 200–2000 inquiries per cycle per college. Today, every lead is treated with equal urgency, and routing is rule-based on coarse attributes (source, programme, geography). Officers waste time on cold leads while hot ones go stale. The `Inquiry.leadScore` field exists in the schema and the W01 workflow step is wired, but no compute engine populates it — scores stay at 0.

**Goal:** Populate `leadScore` (0–100) and `leadGrade` (hot/warm/cold/dormant) automatically for every inquiry, using a hybrid of deterministic rules and Juvi LLM signal, so AssignmentRule routing and officer dashboards prioritize the right leads.

## 2. User Stories & Acceptance Criteria

### Story 1 — Auto-score on inquiry creation
**As** an admissions officer
**I want** every new inquiry to receive a lead score within 2 minutes of creation
**So that** AssignmentRule can route hot leads to me immediately and I focus where it matters.

**Acceptance Criteria:**
1. When `POST /api/admissions/inquiries` creates an Inquiry, a `LEAD_SCORING` job is enqueued automatically.
2. Within 120 seconds, the Inquiry doc is updated with `leadScore` (0–100), `leadGrade`, and `scoreRationale` (factor breakdown).
3. The score write triggers a `createAuditLog` entry with `action: 'ai_score_computed'` and the rationale as `changes`.
4. AssignmentRule re-evaluation runs after scoring so `leadScore`/`leadGrade` conditions apply to the newly scored inquiry.

### Story 2 — Re-score on interaction
**As** an admissions officer
**I want** the score to refresh after I log a new interaction (call, WhatsApp, walk-in)
**So that** an engaged lead's score reflects recent positive signals.

**Acceptance Criteria:**
1. When `POST /api/admissions/inquiries/:id/interactions` creates a LeadInteraction with `outcome` in {interested, callback_requested, visit_scheduled, converted}, a re-score job is enqueued.
2. The re-score job is debounced per inquiry (max 1 rescore per 5 minutes per inquiry).
3. `scoreRationale` includes a `lastInteractionInfluence` factor showing how the latest interaction shifted the score.

### Story 3 — Manual recompute + batch backfill
**As** an admissions counsellor lead
**I want** to manually trigger rescoring (single inquiry or whole pipeline)
**So that** I can backfill historical leads or recompute after tuning the prompt.

**Acceptance Criteria:**
1. `POST /api/admissions/inquiries/:id/rescore` enqueues a high-priority scoring job, returns 202 with `jobId`.
2. `POST /api/admissions/lead-scoring/batch` accepts a filter (status, source, dateRange) and enqueues N jobs, returns `{ enqueued: N, batchId }`.
3. `GET /api/admissions/lead-scoring/batch/:batchId` returns `{ total, completed, failed, inProgress, samples }`.
4. Batch is rate-limited per college: max 500 LLM-backed scores per college per 24h (config via env `LEAD_SCORE_DAILY_LLM_CAP`, default 500). Excess inquiries score with rules-only fallback and `scoreRationale.llmSkipped: true`.

### Story 4 — See score in UI
**As** an admissions officer
**I want** to see each inquiry's score and grade in the list and detail view
**So that** I can prioritize without leaving the page.

**Acceptance Criteria:**
1. InquiriesPage row shows a colored badge: hot=red, warm=orange, cold=gray, dormant=slate. Score number rendered next to badge.
2. Sortable by `leadScore` desc.
3. Filter chip: "Hot only", "Warm+Hot", "All".
4. Inquiry detail modal shows the rationale: top 3–5 contributing factors with weights (e.g., "Source: walk-in (+18)", "Interaction count: 4 (+12)", "LLM signal: high interest in MPC (+22)").
5. A "Recompute score" button appears in the detail modal for users whose RBAC allows `authorize('admissions', 'update')` — covers `ST-ADM-DIR` (Admissions Director) and any persona with `'*'` admissions action. Counsellors with read-only admissions access do NOT see the button. _(GATE 2 finding C-API-1: chose persona-based authz over a new `admissions_admin` role.)_

### Story 5 — Observability + cost guardrails
**As** a college admin
**I want** to see how many LLM-backed scores ran today and what they cost
**So that** I can govern LLM spend.

**Acceptance Criteria:**
1. `GET /api/admissions/lead-scoring/stats?range=today` returns `{ totalScored, llmScored, rulesOnlyScored, llmCostInr, avgLatencyMs, gradeDistribution }`.
2. Stats are also surfaced on the CRMDashboardPage as a "Lead Scoring" card.
3. When daily LLM cap is hit, the system logs a structured warn-level event `lead-scoring:llm-cap-reached` and the UI card shows a yellow banner.

## 3. Scoring Model (Hybrid)

```
finalScore = clamp(0, 100, round(0.6 * ruleScore + 0.4 * llmScore))
leadGrade  = deriveLeadGrade(finalScore)   // existing helper
```

**Rule component (`ruleScore` 0–100):** deterministic features extracted from Inquiry + LeadInteraction:
- Source quality (walk-in: 25, referral: 20, education_fair: 18, website: 12, social_media: 10, whatsapp: 12, newspaper: 6, phone: 14)
- Academic fit (interPercentage >= 80: +18, 60–79: +10, <60: +2; missing: 0)
- Programme/branch interest specified: +10
- UTM campaign present (paid traffic): +6
- Interaction count: 0→0, 1→+6, 2–3→+12, 4+→+18
- Last interaction recency: <24h +10, <7d +6, <30d +2, else 0
- Last positive outcome (interested/visit_scheduled/converted): +15
- Negative outcome (not_interested) or dormant (no interaction >30d): -20 floor

Clamped to 0–100 before blending.

**LLM component (`llmScore` 0–100):** Juvi LLM call with masked Inquiry summary + last 5 interaction transcripts/notes. Returns:
```json
{ "score": 0-100, "factors": [{ "label": "...", "weight": int }], "summary": "..." }
```
JSON schema enforced in prompt; on parse failure → `llmScore = ruleScore` and rationale marks `llmFallback: true`.

**Rationale storage** on Inquiry:
```typescript
scoreRationale: {
  ruleScore: number;
  llmScore: number | null;
  blendedScore: number;
  factors: Array<{ label: string; weight: number; source: 'rule'|'llm' }>;
  llmSkipped?: boolean;
  llmFallback?: boolean;
  llmCostInr?: number;
  computedAt: Date;
  modelVersion: string;  // e.g., 'rules-v1+claude-sonnet-4.5'
}
```

## 4. Out of Scope

- Training a custom ML model (deferred — revisit when we have >5k converted leads per college)
- Placement lead scoring (M07) — confirmed separately
- Real-time streaming score updates to UI (poll/refetch is fine for v1)
- Per-college prompt tuning UI (env-level only for v1)
- Predictive enrollment probability (different model, future)

## 5. Constraints & Non-Functional Requirements

| NFR | Target |
|---|---|
| Score latency (single inquiry, LLM path) | p95 < 8s |
| Score latency (rules-only fallback) | p95 < 200ms |
| Queue throughput | 50 jobs/min sustained |
| LLM cost cap | ₹500/college/day default (configurable) |
| PII handling | Inquiry phone/email masked before LLM context (reuse `prompts.ts` pattern) |
| Multi-tenancy | All reads/writes filter by `collegeId`; queue jobs carry `collegeId` in payload |
| Auditability | Every score write produces an audit log entry with the rationale snapshot |
| Idempotency | Same Inquiry scored twice within 60s → second job no-ops |

## 6. Dependencies

- LLM client + cost tracking: `backend/src/modules/juvi/finance-agent/llm-client.ts` ✓
- BullMQ queue manager: `backend/src/shared/queue/QueueManager.ts` ✓
- Audit utility: `backend/src/shared/audit.ts` ✓
- Existing W01 `lead_score` workflow handler — will be invoked by our worker

## 7. Risks

| Risk | Mitigation |
|---|---|
| LLM cost spirals on bulk import | Per-college daily cap + rules-only fallback |
| Prompt drift / inconsistent scoring | Pin `modelVersion` in rationale; store prompt template version |
| Slow LLM responses block worker | 12s timeout via `AbortSignal`; fall back to rules-only |
| Hot lead misclassified | Manual recompute + admin override on the score (post-MVP slider) |
| PII leak via LLM | Masking already standard; add unit test for masker |

## 8. Open Questions

_None remaining — Q1 (scope) and Q2 (approach) answered upfront. GATE 2 findings resolved in §10._

## 10. GATE 2 Remediations & Detailed Design

This section addresses every CRITICAL and HIGH finding from `gate2-architecture.md`, `gate2-data-layer.md`, `gate2-api-security.md`.

### 10.1 Schema additions to `Inquiry` (CRITICAL)

Append these fields to `backend/src/models/admissions/Inquiry.ts`:

```typescript
// Interface additions
scoreRationale?: ScoreRationale;
lastScoredAt?: Date;

// Type
export interface ScoreRationale {
  ruleScore: number;
  llmScore: number | null;
  blendedScore: number;
  factors: Array<{ label: string; weight: number; source: 'rule' | 'llm' }>;
  lastInteractionInfluence?: { factor: string; shift: number };
  llmSkipped?: boolean;
  llmFallback?: boolean;
  llmCostInr?: number;
  computedAt: Date;
  modelVersion: string; // e.g. 'rules-v1+claude-sonnet-4.5'
}

// Schema definition (strict subdocument, not Mixed)
scoreRationale: {
  type: {
    ruleScore: { type: Number, required: true },
    llmScore: { type: Number, default: null },
    blendedScore: { type: Number, required: true },
    factors: [{
      label: String,
      weight: Number,
      source: { type: String, enum: ['rule', 'llm'] },
    }],
    lastInteractionInfluence: { factor: String, shift: Number },
    llmSkipped: { type: Boolean, default: false },
    llmFallback: { type: Boolean, default: false },
    llmCostInr: Number,
    computedAt: Date,
    modelVersion: String,
  },
  _id: false,
},
lastScoredAt: { type: Date, index: true },
```

### 10.2 New compound indexes on `Inquiry` (HIGH)

```typescript
schema.index({ collegeId: 1, leadScore: -1 });
schema.index({ collegeId: 1, leadGrade: 1, leadScore: -1 });
schema.index({ collegeId: 1, lastScoredAt: -1 });
```

### 10.3 New model `LeadScoringStats` (HIGH — replaces ad-hoc aggregation)

`backend/src/models/admissions/LeadScoringStats.ts`:

```typescript
export interface ILeadScoringStats extends Document {
  collegeId: Schema.Types.ObjectId;
  date: Date; // UTC start-of-day bucket
  totalScored: number;
  llmScored: number;
  rulesOnlyScored: number;
  totalLlmCostInr: number;
  avgLatencyMs: number;
  gradeDistribution: { hot: number; warm: number; cold: number; dormant: number };
  llmCapHit: boolean;
  modelVersion: string;
}
// indexes: { collegeId: 1, date: -1 } (unique compound)
```

The scorer increments this doc atomically (`findOneAndUpdate` with `$inc`/`$set`, `upsert: true`) on every score completion.

### 10.4 Audit action extension (CRITICAL)

Add `'ai_score_computed'` to:
- `AuditAction` union in `backend/src/shared/types.ts`
- `AUDIT_ACTIONS` array in `backend/src/shared/audit.ts`

### 10.5 PII masker extraction (HIGH)

Move `backend/src/modules/juvi/finance-agent/pii.ts` → `backend/src/shared/llm/pii.ts`. Update finance-agent imports. The scoring worker imports `maskPII` from the shared location. Unit test asserts phone/email/aadhaar are tokenized before any LLM payload is constructed.

### 10.6 Idempotency strategy (HIGH)

Two layers:

1. **BullMQ jobId dedup** — when enqueuing:
   ```typescript
   const jobId = `score:${collegeId}:${inquiryId}:${Math.floor(Date.now() / 60_000)}`;
   await queue.add('score', { inquiryId, collegeId, performedBy, trigger }, { jobId });
   ```
   Same inquiry enqueued twice within the same minute → BullMQ rejects duplicate.

2. **Worker-level debounce** — at the start of the worker, read `inquiry.lastScoredAt`. If `Date.now() - lastScoredAt.getTime() < 60_000`, log and return early (no-op). For the 5-min interaction rescore window (Story 2 AC#2), the threshold is `5 * 60_000`.

### 10.7 Daily LLM cap — atomic Redis check (HIGH)

```typescript
const today = new Date().toISOString().slice(0, 10);
const key = `lead-score:llm-count:${collegeId}:${today}`;
const dailyCap = parseInt(process.env.LEAD_SCORE_DAILY_LLM_CAP || '500', 10);

const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 86_400);

if (count > dailyCap) {
  // rollback the count we just claimed so other races don't read inflated
  await redis.decr(key);
  rationale.llmSkipped = true;
  // proceed with rules-only
} else {
  // proceed with LLM call
}
```

### 10.8 LLM 12s timeout pattern (HIGH)

Inside the worker (not the LLM client):

```typescript
const ctrl = new AbortController();
const timer = setTimeout(() => ctrl.abort(), 12_000);
try {
  const result = await llmClient.complete(messages, { abortSignal: ctrl.signal });
  return result;
} catch (err) {
  if (ctrl.signal.aborted) {
    rationale.llmFallback = true;
    return null;
  }
  throw err;
} finally {
  clearTimeout(timer);
}
```

### 10.9 Assignment rule re-evaluation trigger (CRITICAL)

After the worker writes `leadScore`/`leadGrade`/`scoreRationale`:

1. Call the existing assignment-rule evaluator (refactor `applyAssignmentRulesOnCreate` → `applyAssignmentRules(collegeId, inquiry)`).
2. If a rule matches and updates `assignedOfficerId`, write an audit log entry with `action: 'update'`, `changes: [{ field: 'assignedOfficerId', ... }]`.
3. This runs synchronously inside the scoring job (post-write), not as a separate queue job — keeps causality tight and avoids a chain of jobs.

### 10.10 Module boundaries (HIGH)

- **Admissions module owns** the scorer end-to-end: `lead-scoring-service.ts` (rule scorer, blending, queue plumbing), `lead-scoring-worker.ts` (BullMQ processor), `lead-scoring-prompt.ts` (LLM prompt builder), `routes.ts` additions, controller, validation.
- **Juvi module exposes** only the LLM client (`llm-client.ts`) and the shared PII masker (after §10.5 move).
- Admissions imports juvi; juvi does not import admissions. No circular dependency.

### 10.11 `performedBy` propagation (MEDIUM, but compliance-relevant)

Job payload carries `performedBy`:
- Auto-score on create → `performedBy: req.user!.id`
- Re-score on interaction → `performedBy: req.user!.id`
- Manual rescore → `performedBy: req.user!.id`
- Batch backfill → `performedBy: 'system:lead-scoring-batch'` (with `triggeredBy: req.user!.id` in metadata)

Worker passes `performedBy` to `createAuditLog`.

### 10.12 `deriveLeadGrade` export (MEDIUM)

Move `deriveLeadGrade(score)` from `workflow.handlers.ts` to `backend/src/modules/admissions/lead-scoring/grade.ts` (new file). Re-export from `workflow.handlers.ts` to avoid breaking the W01 handler.

### 10.13 Backfill plan (HIGH)

On feature rollout per college:
1. One-time MongoDB update: `db.inquiries.updateMany({ collegeId, leadScore: { $exists: false } }, { $set: { leadScore: 0, leadGrade: 'dormant' } })` — establishes the baseline so the UI doesn't show mixed scored/unscored rows.
2. Trigger a batch rescore (Story 3 endpoint) with filter `{ leadGrade: 'dormant', updatedAt: { $gte: <90 days ago> }}` to score the last 90 days of inquiries with the new model.
3. Documented in the feature's rollout runbook (out of this spec, but called out).

### 10.14 HTTP API contract (HIGH)

| Scenario | Code | Body |
|---|---|---|
| Rescore enqueued | 202 | `{ jobId, status: 'enqueued' }` |
| Inquiry not found | 404 | `{ error: 'Inquiry not found' }` |
| Invalid filter (batch) | 400 | `{ error: '...' }` |
| Daily LLM cap reached (job still runs rules-only) | 202 | `{ jobId, status: 'enqueued', llmSkipped: true, reason: 'cap_reached' }` |
| Unauthorized | 403 | `{ error: 'Access denied' }` |
| Duplicate within 60s | 208 | `{ jobId: <existing>, status: 'already_scored', lastScoredAt }` |

LLM timeout / parse failure are NOT errors — they manifest as `scoreRationale.llmFallback: true` on the resulting Inquiry doc and the job completes 2xx.

### 10.15 Stats response example (LOW)

```json
{
  "totalScored": 312,
  "llmScored": 285,
  "rulesOnlyScored": 27,
  "llmCostInr": 423.50,
  "avgLatencyMs": 4280,
  "gradeDistribution": { "hot": 42, "warm": 88, "cold": 130, "dormant": 52 },
  "capReached": false,
  "modelVersion": "rules-v1+claude-sonnet-4.5"
}
```

## 9. Success Metrics (post-launch, 30-day)

- % of inquiries with a non-zero score: > 95%
- AssignmentRule match rate using `leadScore`/`leadGrade`: > 60% of routes
- Officer-reported "score helped me prioritize": qualitative survey ≥ 4/5
- LLM cost per scored lead: < ₹1.50 average
