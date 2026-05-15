# Feature Spec — Natural-Language Report Queries (Gap 4 Differentiation)

**Feature ID:** 003-nl-report-queries
**Module:** M11 Governance (report-engine surface)
**Status:** Draft (pre-GATE 2). **Narrow v1** per discovery (GATE 0).
**Date:** 2026-05-14

## 1. Problem & Motivation

The declarative report engine (commit `9cc8ecc`) defines 12 reports but **only 2–3 have working runners** (`admissions-funnel`, `lead-source-performance`, partial `student-roster-snapshot`); the other 10 are Phase B stubs. Reports today require the user to pick a report, then fill a parameter form. An LLM can map a plain-English question — "How did the September funnel compare to August?" — to the right report + params, eliminating the discovery friction.

**Goal (narrow v1):** Add an "Ask a question" textarea on the Reports page. Admin types a question. LLM picks one of the 2–3 working reports + fills its parameters. The chosen report executes through the existing `report-service` runner. Results render in the existing result table.

**Scoped narrow because:**
- Foundation gap: 10/12 runners are unimplemented — exposing them via NL would surface "unimplemented" errors.
- RBAC gap: row-level scope isn't enforced at the query layer — exposing NL to HOD/student/parent personas would be unsafe today.

**Roadmap acknowledged:** Wider NL coverage waits on more Phase B runners; cross-persona NL waits on row-level RBAC at the query layer (potential separate feature).

## 2. User Stories & Acceptance Criteria

### Story 1 — Ask a question, get an answered report
**As** an admin or super_admin
**I want** to type a natural-language question on the Reports page
**So that** the right report runs without me hunting through a picker.

**ACs:**
1. `POST /api/governance/reports/nl-query` accepts `{ question: string }` and returns either a "matched" response or a "refused" response.
2. **Matched** response: `{ status: 'matched', reportCode, params, runId, results, rationale, model, costInr }`. The chosen `reportCode` MUST be one of the implemented set (`admissions-funnel`, `lead-source-performance`, `student-roster-snapshot`). The chosen report executes through `report-service.runReport(reportCode, params)` exactly as if the user had picked it.
3. **Refused** response: `{ status: 'refused', reason, supportedReports: string[], model, costInr }`. Returned when the LLM cannot map the question to a working report, or maps to a Phase B stub.
4. Both responses persist a `NlReportQuery` document with `question`, `selectedReport`, `params`, `status`, `runId?`, `costInr`, `model`, `promptVersion`, `performedBy`.
5. Route uses `authorize('governance', 'read')` AND a hard-coded role gate restricting to admin / super_admin (`req.user.role in ['admin', 'super_admin']`); 403 otherwise.
6. `createAuditLog` writes `action: 'ai_nl_report_query'` with the question (truncated to 200 chars) and the chosen report.

### Story 2 — Provenance + manual fallback
**As** the same admin
**I want** to see which report the LLM chose and why
**So that** I trust the result and can re-run it directly if needed.

**ACs:**
1. The Reports page shows a new "Ask a question" textarea above the existing report picker.
2. On a `matched` response, the result panel renders: a banner reading "Auto-selected: <reportName> — <rationale>", the param values the LLM filled in, and the result table (same component the existing picker flow renders).
3. The banner has a "Run as picker" button that re-opens the selected report in the existing param-form flow with the same params pre-filled. Acts as an audit + escape hatch.
4. On a `refused` response, the page shows the refusal `reason` plus a chip list of the 2–3 supported reports — the user can click any chip to switch to the existing picker flow.

### Story 3 — Cap + observability
**As** a college admin
**I want** NL queries to share the LLM cost budget governance
**So that** spend stays bounded.

**ACs:**
1. Cap-guard enforces `NL_REPORT_DAILY_LLM_CAP` (default 30/college/day). Cap-hit returns `{ status: 'refused', reason: 'cap_reached', supportedReports }` and writes an audit entry tagged `cap_reached: true`.
2. `GET /api/governance/reports/nl-query/stats?range=today|week|month` returns `{ totalQueries, matched, refused, llmCostInr, byReport }` aggregated from `NlReportQuery` documents.
3. The Reports page shows a small "Today: 4 / 30" inline counter; amber banner when cap is reached.

### Story 4 — Foundation bug fix
**As** the maintainer
**I want** the pre-existing `report-registry.ts:183` `$match: { collegeId }` ObjectId-wrap bug fixed
**So that** the existing `aggregate-collegeid-pattern` regression-guard test passes AND any new aggregation runner added under 003 starts on a clean foundation.

**ACs:**
1. The match stage at `report-registry.ts:183` wraps `collegeId` via `new mongoose.Types.ObjectId(collegeId)` (per the project pattern in other modules).
2. `npm run test -w backend` passes the `regression-guards/aggregate-collegeid-pattern.test.ts` suite — the test that has been red across recent runs.
3. The fix is committed in 003's chunk but kept in its own commit for reviewer clarity.

## 3. NL Translation Design

### Prompt shape

```
SYSTEM
You are the Juvion Report Navigator for an Indian college admin. You map
plain-English questions to one of a small set of implemented reports.

You may ONLY pick from this allow-list (param keys are EXACTLY what the runners accept — see §10.5 for the GATE 2 correction):
  - "admissions-funnel"  — params: { from, to } (ISO 8601 dates, both required)
  - "lead-source-performance" — params: { from, to } (ISO 8601 dates, both required)
  - "student-roster-snapshot" — params: { status: "active" | "all" } (default "active")

Return ONLY a single JSON object — either:
  { "status": "matched", "reportCode": "<one of the above>", "params": { ... }, "rationale": "<one sentence>" }
OR
  { "status": "refused", "reason": "<one sentence explaining why no match>" }

Guidelines:
- Never invent a reportCode outside the allow-list. If the question doesn't fit, refuse.
- Dates: prefer ISO yyyy-mm-dd. If the user says "last month", resolve relative to TODAY (passed in user content).
- If params are missing required values, refuse with a hint about what the user should specify.

USER
Today: <iso date>
Question: <user question>
```

### Validation layer (post-LLM, pre-run)

The NL service applies these checks before calling `report-service`:
1. `reportCode` is in the allow-list (else convert to `refused`).
2. `params` shape matches the report's declared params (else `refused`).
3. Dates are ISO and within a sane range (`fromDate <= toDate`, no future endpoints beyond today + 1y).
4. The caller's role is admin or super_admin (enforced upstream at the route).
5. Resulting report run still goes through the normal `report-service.runReport`, which already injects `collegeId` — multi-tenancy is preserved by the existing layer.

### Storage

New Mongoose model `NlReportQuery`:

```typescript
interface INlReportQuery extends Document {
  collegeId: Schema.Types.ObjectId;
  question: string;                              // PII-masked, capped 500 chars (§10.7)
  status: 'matched' | 'refused';                 // enum-constrained
  selectedReport?: string;
  params?: Record<string, unknown>;
  reason?: string;                               // GATE 2 §10.4: was refusalReason
  runId?: Schema.Types.ObjectId;                 // ref ReportRun when matched
  performedBy: string;
  generatedAt: Date;
  llmModel: string;                              // GATE 2 §10.4: not `model` — collides with Document.model()
  promptVersion: string;
  costInr: number;
  capReached?: boolean;
}
```

Indexes: `{collegeId: 1, generatedAt: -1}`, `{collegeId: 1, status: 1, generatedAt: -1}`.

## 4. Out of Scope (v1)

- NL queries for non-admin personas (HOD, student, parent). Requires row-level RBAC at the query layer first — separate feature.
- NL access to Phase B stub reports — they would just throw "unimplemented".
- Saved/favorited NL queries (return for v2 with naming + tags).
- Free-form ad-hoc aggregation (`$group` LLM output) — strictly allow-listed reports for v1.
- Multi-step / clarification dialogs ("did you mean A or B?") — single shot only.
- Visualization beyond the existing result table.

## 5. Constraints & NFRs

| NFR | Target |
|---|---|
| Endpoint p95 latency (LLM + report run) | < 15s |
| Per-college daily cap | 30 NL queries / college / day default (`NL_REPORT_DAILY_LLM_CAP`) |
| LLM timeout | 10s `AbortController` for the translation call |
| Auth | admin or super_admin only — hard-coded role check on top of `authorize('governance', 'read')` |
| Multi-tenancy | `collegeId` injected by `report-service` (existing); NL layer cannot bypass |
| Question content sanity | input length capped at 500 chars; reject empty / whitespace-only |
| Audit | every call writes one `ai_nl_report_query` log entry |
| PII | question may include free text; we DO NOT pass any college data into the LLM context beyond the allow-list — the LLM doesn't see student rows. PII masker called defensively on the question itself before logging |

## 6. Dependencies

- LLM client: `backend/src/modules/juvi/finance-agent/llm-client.ts`
- Cap-guard pattern: `backend/src/modules/admissions/lead-scoring/cap-guard.ts`
- Prompt pattern: `backend/src/modules/admissions/lead-scoring/prompt.ts`
- JSON parser pattern: `backend/src/modules/admissions/lead-scoring/llm-scorer.ts`
- Report engine: `backend/src/modules/governance/{report-registry,report-service,report-controller,routes}.ts`
- Existing `ReportRun` persistence: `backend/src/models/governance/ReportRun.ts`
- Audit infra: extend `AuditAction` with `'ai_nl_report_query'`

## 7. Risks

| Risk | Mitigation |
|---|---|
| LLM picks a Phase B stub | Allow-list constraint + post-LLM validator: any reportCode outside allow-list → refuse |
| Param injection / unsafe filters | Strict shape validation on `params` against report's declared param schema |
| Cap exhaustion blocks legitimate admin use | Cap chosen low (30/day); error message clearly explains the cap; observable via stats endpoint |
| Cross-tenant data leak via crafted question | `collegeId` is injected by `report-service` post-LLM; LLM never sees other colleges' data; question text passed only to LLM |
| Pre-existing `:183` bug masks regressions | Fixed in this feature (Story 4) |
| Future expansion to non-admin personas without row-level RBAC | Hard 403 today; row-level RBAC is its own separate feature ("003-pre") |

## 8. Success Metrics (30-day post-launch)

- % of report runs originating from NL: > 25% within admin/super_admin sessions
- NL "matched" rate: > 70% (signals coverage of the 3-report allow-list is meaningful)
- Avg LLM cost per NL query: < ₹0.50 (small prompts, narrow output)

## 9. Open Questions

_None — discovery + GATE 0 resolved them. Narrow scope is deliberate. GATE 2 findings folded in §10._

## 10. GATE 2 Remediations

Folds every CRITICAL / MAJOR / actionable MEDIUM finding from `gate2-architecture.md`, `gate2-data-layer.md`, and `gate2-api-security.md`.

### 10.1 Role gate via new `requireRole(...)` middleware (CRITICAL)

The existing `authorize()` middleware is policy-based; there's no "minimum role" precedent. Instead of an in-handler check (which would scatter across handlers and be easy to forget), introduce a small declarative middleware:

```typescript
// backend/src/middleware/requireRole.ts (NEW)
import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';

export function requireRole(roles: ReadonlyArray<string>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Required role missing' });
    }
    next();
  };
}
```

The NL-query route uses it stacked with `authorize`:

```typescript
router.post(
  '/reports/nl-query',
  authorize('governance', 'read'),
  requireRole(['admin', 'super_admin']),
  validate(nlQuerySchema),
  ctrl.nlQueryHandler,
);
```

Story 1 AC#5 (and #6) become: middleware enforces 403 for non-admin roles; no in-handler check needed.

### 10.2 `AuditAction` extension (CRITICAL)

Extend `AuditAction` union in `backend/src/shared/types.ts` and `AUDIT_ACTIONS` array in `backend/src/shared/audit.ts`:

```typescript
| 'ai_nl_report_query'
```

Mirrors the same pattern used for `ai_score_computed` (001), `ai_config_suggested` / `ai_config_applied` (002).

### 10.3 `report-registry.ts:183` regression-guard fix (CRITICAL, Story 4)

Runtime behavior is already correct — `collegeId` is wrapped at line 177. The `aggregate-collegeid-pattern` regression-guard test is a **static pattern check** that flags the literal shorthand `{ collegeId,` regardless of variable type. To make the test pass without behavior change, rename the local var so the explicit form is natural:

```typescript
// modules/governance/report-registry.ts
const cidObj = new Types.ObjectId(ctx.collegeId);
// line 183:
{ $match: { collegeId: cidObj, createdAt: { $gte: from, $lte: to } } }
```

Apply the same rename to **all** sites the regression-guard flags (re-run the test after the fix to confirm no other sites linger). Story 4 stays in scope; the fix is two-line per site, no logic change.

### 10.4 Model field rename + `refusalReason` → `reason` (CRITICAL + MINOR)

The Mongoose `Document` interface has a `.model()` method that collides with a top-level `model: string` field on the schema. Renamed to `llmModel` (same fix shipped in 002's `ConfigSuggestion`). The HTTP refused-response body uses `reason`; the model now uses `reason` too (was `refusalReason`) so wire and storage match.

### 10.5 Allow-list param shapes corrected (LOW — arch finding)

Verified against the actual runners in `backend/src/modules/governance/report-registry.ts`:

| Report | Params | Notes |
|---|---|---|
| `admissions-funnel` | `{ from: ISODate, to: ISODate }` | Both required. NOT `fromDate/toDate`. NOT `programmeId` (the runner ignores it). |
| `lead-source-performance` | `{ from: ISODate, to: ISODate }` | Both required. |
| `student-roster-snapshot` | `{ status: 'active' \| 'all' }` | Default `'active'`. No date / programme / branch params. |

The prompt's allow-list block + the post-LLM validator both use these exact shapes.

### 10.6 Module boundary (LOW — arch finding)

New sub-module `backend/src/modules/governance/nl-reports/` mirrors `admissions/lead-scoring/`:
- `service.ts` — orchestrator (idempotency → cap-guard → mask → prompt → LLM → parse → validate → run + persist + audit).
- `prompt.ts` — system + user `LLMMessage[]` builder + `PROMPT_VERSION = 'nl-report-prompt-v1'`.
- `parser.ts` — strict JSON parse with fence stripping.
- `validator.ts` — allow-list + param-shape + date-bounds check (returns `{ ok, normalized }` or `{ refused, reason }`).
- `cap-guard.ts` — thin wrapper calling shared `tryClaimLLMSlot(..., 'nl-reports')`.

Controller handler stays in `governance/report-controller.ts`.

### 10.7 PII masking flow (MEDIUM/MAJOR)

Explicit data flow:

```
question (raw user input)
  → maskPII(question)        // returns { masked, tokenMap }
  → send `masked` to LLM      // LLM never sees raw PII
  → parse LLM response
  → persist `masked` in NlReportQuery.question (capped 500 chars)
  → audit log entry uses the same masked form, truncated to 200 chars
```

`tokenMap` is discarded after the LLM call — there's no need to un-mask anything in NL-report output (the LLM only emits a `reportCode` + `params`, not free text the user reads back). Questions like "fee status for John Doe" become `"fee status for {name_1}"` everywhere; the audit reviewer can reconstruct intent from context without seeing the raw name.

### 10.8 Allow-list + LLM-output Zod schema (MAJOR)

```typescript
const ALLOWED_REPORTS = ['admissions-funnel', 'lead-source-performance', 'student-roster-snapshot'] as const;

const llmOutputSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('matched'),
    reportCode: z.enum(ALLOWED_REPORTS),
    params: z.record(z.unknown()),
    rationale: z.string().min(1).max(200),
  }),
  z.object({
    status: z.literal('refused'),
    reason: z.string().min(1).max(200),
  }),
]);
```

If parse fails or `status === 'matched'` but `reportCode` isn't in `ALLOWED_REPORTS` (shouldn't happen with the Zod enum but defense in depth), convert to `refused` with `reason: 'LLM returned an unsupported report'`.

### 10.9 Date / param bounds (MAJOR)

After Zod parsing, the validator enforces:

```typescript
const now = new Date();
const min = new Date(now); min.setUTCFullYear(now.getUTCFullYear() - 5);   // 5y past
const max = new Date(now); max.setUTCFullYear(now.getUTCFullYear() + 1);   // 1y future

// For admissions-funnel and lead-source-performance:
if (!from || !to) return refused('Missing from or to date');
if (from > to) return refused('from must be <= to');
if (from < min) return refused('from cannot be more than 5 years in the past');
if (to > max) return refused('to cannot be more than 1 year in the future');

// For student-roster-snapshot:
if (params.status !== undefined && !['active', 'all'].includes(params.status)) {
  return refused('status must be "active" or "all"');
}
```

### 10.10 Idempotency — 30s dedup window (MAJOR)

Mirror config-suggest's approach:

```typescript
const key = `nl-report-dedup:${collegeId}:${sha1(maskedQuestion)}`;
const existing = await redis.get(key);
if (existing) return JSON.parse(existing); // { ...prior response, isDuplicate: true }
const result = await runFreshNlQuery(...);
await redis.setex(key, 30, JSON.stringify(result));
return result;
```

The key uses the *masked* question hash so users typing the same intent twice within 30s get the cached run.

### 10.11 HTTP response contract (MAJOR)

| Scenario | Code | Body |
|---|---|---|
| Matched, report ran | 200 | `{ status: 'matched', reportCode, params, runId, results, rationale, llmModel, costInr }` |
| Refused (LLM picked stub / refused / unsafe) | 200 | `{ status: 'refused', reason, supportedReports: [...], llmModel, costInr }` |
| Daily cap reached (cap-guard) | 200 | `{ status: 'refused', reason: 'cap_reached', supportedReports: [...] }` |
| LLM timeout (10s abort) | 200 | `{ status: 'refused', reason: 'timeout', supportedReports: [...] }` |
| Idempotent duplicate (<30s) | 200 | (prior response) + `isDuplicate: true` |
| Empty/whitespace question | 400 | `{ error: 'Question required and non-empty' }` |
| Question > 500 chars | 400 | `{ error: 'Question too long (max 500 chars)' }` |
| Unauthenticated | 401 | `{ error: 'Not authenticated' }` |
| Non-admin role | 403 | `{ error: 'Required role missing' }` |
| Report-service errors (unexpected) | 500 | `{ error: '...' }` |

LLM timeout + cap-reached are NOT errors — graceful degradation.

### 10.12 Stats aggregation pipeline (MINOR)

Pseudocode for `GET /reports/nl-query/stats?range=today|week|month`:

```typescript
// collegeId is the first $match stage (§10 multi-tenancy guard).
const pipeline = [
  { $match: { collegeId: cidObj, generatedAt: { $gte: rangeStart, $lte: rangeEnd } } },
  { $facet: {
      byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
      byReport: [
        { $match: { status: 'matched' } },
        { $group: { _id: '$selectedReport', count: { $sum: 1 }, costInr: { $sum: '$costInr' } } },
      ],
      total: [{ $group: { _id: null, totalQueries: { $sum: 1 }, llmCostInr: { $sum: '$costInr' } } }],
  }},
];
```

Response shape:
```typescript
{
  range: 'today',
  totalQueries: 42,
  matched: 38,
  refused: 4,
  llmCostInr: 12.45,
  byReport: [{ reportCode: 'admissions-funnel', count: 25, costInr: 7.10 }, ...],
}
```

### 10.13 `PROMPT_VERSION` constant (INFO)

`export const PROMPT_VERSION = 'nl-report-prompt-v1';`. Matches the 001/002 convention. Bump the suffix when the prompt text changes; the value is stored in every `NlReportQuery.promptVersion` so historical scores remain attributable.

### 10.14 `nlQuerySchema` for the request body

```typescript
const nlQuerySchema = z.object({
  question: z.string().trim().min(1, 'Question required').max(500, 'Max 500 chars'),
}).strict();
```

