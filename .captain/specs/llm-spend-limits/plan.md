# Plan: Per-College LLM Spend Limits

**Spec:** `./spec.md` · **Created:** 2026-04-28

---

## 1. Architecture

### 1.1 Component map

```
                        Admin sets limit on College Mgmt page
                                     │
                                     ▼
                  PATCH /api/colleges/:id/ai-spend-limits
                                     │
                                     ▼
                       College.aiSpendLimits stored in Mongo
                                     │
                                     │ (read in pre-call gate)
                                     ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ LLM call site (live, non-cached)                            │
   │   ▼                                                          │
   │ assertWithinSpendLimit(collegeId)                           │
   │   ├─ load College.aiSpendLimits (60s in-process cache)       │
   │   ├─ if weeklyInr === 0: bypass; return state for logging    │
   │   ├─ load 7-day cumulative spend from AgentAction (60s cache)│
   │   ├─ if spent >= weeklyInr: throw AppError(429)             │
   │   ├─ if spent >= weeklyInr * pct/100: log warn, set flag     │
   │   └─ return { spent, limit, pct, warning: bool }             │
   │   ▼                                                          │
   │ (proceed with live LLM call)                                │
   └─────────────────────────────────────────────────────────────┘
                                     │
                                     │ Frontend reads `budgetWarning` flag
                                     ▼
                   <FeeDashboardPage> renders banner if flagged
                                     │
                                     ▼
                  Weekly cron @ Mon 06:00 → LLMUsageSnapshot
```

### 1.2 New backend module

`backend/src/modules/platform/spend-limits/` (new):
- `service.ts` — `assertWithinSpendLimit`, `getCurrentSpend`, `updateSpendLimits`
- `cache.ts` — 60s in-process cache (Map<collegeId, { spent, expiresAt }>)
- `cron.ts` — weekly summary worker (Mon 06:00)

### 1.3 New Mongoose model — `LLMUsageSnapshot`

```ts
interface ILLMUsageSnapshot {
  _id: ObjectId;
  collegeId: ObjectId;
  weekStart: Date;            // Monday 00:00 UTC of the snapshot week
  weekEnd: Date;
  totalCostInr: number;
  totalCalls: number;
  byType: {                   // call counts per type
    forecast: number;
    situations: number;
    chat: number;
    'risk-narrative': number;
    'reminder-drafts': number;
    'reminder-approve': number;
    'situation-dismiss': number;
  };
  limitAtTime: number;        // captured snapshot of weeklyInr
  alertThresholdAtTime: number;
  createdAt: Date;
  updatedAt: Date;
}
```

Index: `{ collegeId: 1, weekStart: -1 }`

### 1.4 College model addition

```ts
// existing
collegeSchema = new Schema<ICollege>({
  // ...
  aiSpendLimits: {
    weeklyInr: { type: Number, default: 0, min: 0 },
    alertThresholdPct: { type: Number, default: 80, min: 1, max: 100 },
  },
});
```

Defaults populate on first read for existing colleges; no migration needed.

### 1.5 Pre-call gate — `assertWithinSpendLimit`

```ts
export interface SpendCheckResult {
  spent: number;
  limit: number;
  pct: number;        // 0-100
  warning: boolean;   // pct >= alertThresholdPct
  blocked: boolean;   // pct >= 100 (would have blocked, but caller already past gate if reached here)
}

export async function assertWithinSpendLimit(collegeId: string): Promise<SpendCheckResult>;
```

Logic:

1. Read `College.aiSpendLimits` (cached 60s)
2. If `weeklyInr === 0`: return `{ spent: 0, limit: 0, pct: 0, warning: false, blocked: false }` — bypass
3. Read sum(`AgentAction.costInr`) over rolling 7 days (cached 60s)
4. Compute `pct = (spent / weeklyInr) * 100`
5. If `pct >= 100`: throw `AppError(429, 'Weekly LLM budget exceeded', { spent, limit: weeklyInr, resetsAt })`
6. If `pct >= alertThresholdPct`: log warn + return with `warning: true`
7. Else: return without warning

The caller (e.g. `withCache` fallback path in finance-agent service) catches the 429 and surfaces it; the warning flag is propagated to API response shapes so the frontend can render a banner.

### 1.6 In-process cache

Two TTL maps:
- `collegeLimitsCache: Map<collegeId, { weeklyInr, alertThresholdPct, expiresAt }>` — 60s TTL
- `currentSpendCache: Map<collegeId, { spent, expiresAt }>` — 60s TTL

The 60s TTL is acceptable trade: max 60s of budget lag during a burst of concurrent calls (legitimate for AI-natively responsive UX).

Invalidation:
- Admin updates `College.aiSpendLimits` → invalidate `collegeLimitsCache` entry
- LLM call completes → no automatic spend invalidation (next call within 60s sees stale spend; acceptable)
- Manual admin "refresh" button (out of v1) → invalidate both

### 1.7 Admin endpoint

```
PATCH /api/colleges/:id/ai-spend-limits
Permission: ('platform', 'update')
Rate-limit:  60/min/user
Body (Zod):
  {
    weeklyInr?: number;             // ≥ 0; 0 = no limit
    alertThresholdPct?: number;     // 1-100
  }
```

Logic:
1. Validate caller can edit College :id (existing super_admin override pattern)
2. Update `College.aiSpendLimits.{weeklyInr, alertThresholdPct}` via `findOneAndUpdate`
3. Invalidate `collegeLimitsCache` for this collegeId
4. Emit `AuditLog` entry with `entityType='College'`, `action='update'`, changes per field
5. Return updated `aiSpendLimits` + current spend

### 1.8 API response shape additions

Existing agent endpoints add:
```ts
budgetWarning?: {
  spent: number;
  limit: number;
  pct: number;
  resetsAt: string;        // ISO; next Monday 00:00 UTC
};
```

Backwards-compatible — only present when warning fires. Absent means "no warning".

### 1.9 Weekly cron

```ts
// 0 6 * * 1 — Monday 06:00 UTC
async function llmUsageWeeklyCronWorker(job: Job): Promise<void> {
  const colleges = await College.find({ status: 'active' });
  await withBoundedConcurrency(colleges, 10, async (college) => {
    const weekStart = startOfLastWeek(); // Mon 00:00 UTC of completed week
    const weekEnd = endOfLastWeek();
    const aggregate = await AgentAction.aggregate([
      { $match: { collegeId: college._id, createdAt: { $gte: weekStart, $lte: weekEnd } } },
      { $group: { _id: '$type', count: { $sum: 1 }, cost: { $sum: '$costInr' } } },
    ]);
    const byType = {};
    let totalCallCount = 0, totalCost = 0;
    for (const row of aggregate) {
      byType[row._id] = row.count;
      totalCallCount += row.count;
      totalCost += row.cost;
    }
    await LLMUsageSnapshot.create({
      collegeId: college._id, weekStart, weekEnd,
      totalCostInr: totalCost, totalCalls: totalCallCount, byType,
      limitAtTime: college.aiSpendLimits.weeklyInr,
      alertThresholdAtTime: college.aiSpendLimits.alertThresholdPct,
    });
    console.log(`[llm-budget:weekly] college=${college._id} spent=${totalCost} limit=${college.aiSpendLimits.weeklyInr} pct=${(totalCost / college.aiSpendLimits.weeklyInr) * 100}`);
  });
}
```

### 1.10 Frontend — Admin UI

Extend `admin-portal/src/pages/CollegeManagement.tsx` (or whichever existing component owns the College config form):

```tsx
<section>
  <h3>AI Spend Limits</h3>
  <div className="grid grid-cols-2 gap-4">
    <input type="number" label="Weekly budget (₹)" min={0} ... />
    <input type="number" label="Alert threshold (%)" min={1} max={100} ... />
  </div>
  <div className="mt-4">
    <SpendUsageBar spent={current.spent} limit={limits.weeklyInr} pct={current.pct} />
    <p className="text-xs text-slate-500">
      Resets every Monday 00:00 UTC. {current.pct >= 80 ? 'Approaching limit.' : 'Within budget.'}
    </p>
  </div>
  <button onClick={save}>Save</button>
</section>
```

Renders a horizontal usage bar (color-coded: green < 80%, amber 80-99%, red ≥ 100%).

### 1.11 Frontend — FeeDashboardPage banner

Add a `BudgetBanner` component above the Page header:

```tsx
function BudgetBanner({ warning, exceeded, spent, limit, pct, resetsAt }) {
  if (!warning && !exceeded) return null;
  const color = exceeded ? 'red' : 'amber';
  const message = exceeded
    ? `AI usage exceeded weekly budget. Contact admin to increase limit.`
    : `AI usage at ${pct.toFixed(0)}% of weekly budget. ₹${(limit - spent).toFixed(0)} remaining.`;
  return (
    <div className={`border-l-4 border-${color}-400 bg-${color}-50 p-3 mb-4 ...`}>
      <strong>{message}</strong>
      <span className="text-sm text-slate-500"> Resets in {timeUntil(resetsAt)}.</span>
    </div>
  );
}
```

The banner is hydrated from the `budgetWarning` field present on the latest agent endpoint response. When 429 is received, dashboard switches all agent surfaces to degraded mode.

---

## 2. Database

### 2.1 New collection
- `LLMUsageSnapshot` (per §1.3)

### 2.2 Existing collections touched
- `College` — new nested `aiSpendLimits` field

### 2.3 Indexes (per §1.3, §1.4)

---

## 3. Dependencies

No new npm packages.

### Environment variables (new)
```
LLM_BUDGET_DEFAULT_WEEKLY_INR=0
LLM_BUDGET_DEFAULT_ALERT_PCT=80
LLM_BUDGET_CACHE_TTL_SECONDS=60
LLM_BUDGET_WEEKLY_SUMMARY_CRON=0 6 * * 1
```

---

## 4. Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | **DB error in spend computation** blocks all calls | Default-allow on error; log critical |
| 2 | **Concurrent calls race past limit** (over by 1-2 calls during race) | 60s cache reduces frequency; tolerable headroom built into `weeklyInr` (admin sets buffer) |
| 3 | **Officer dismisses banner**, doesn't tell admin | Banner persists for the rest of the week; SRE log alerts |
| 4 | **Admin sets limit BELOW current spend** | Block triggers immediately; banner explains; admin can bump back up |
| 5 | **Cache invalidation lag** (admin bumps limit but officer still sees 429 for ≤60s) | Acceptable; admin can manually retry (frontend retry button) |
| 6 | **Time zone confusion** (Monday in IST vs UTC) | Document UTC explicitly; consider per-college TZ override in v2 |
| 7 | **Cost from cron itself** (the weekly summary cron uses MongoDB aggregations, not LLM calls) | No risk; cron is read-only |
| 8 | **Snapshot collection unbounded growth** | One row per college per week = ~52 rows/college/year. Trivial. |
| 9 | **Officer panics** at the warning banner; floods admin with "increase limit" requests | UX work: banner mentions "approaching limit, plan accordingly"; admin gets context to push back |
| 10 | **Budget gate breaks chat streaming** (gate fires mid-stream) | Gate fires at call entry only; mid-stream is safe. Documented. |

---

## 5. Observability

- `[llm-budget] college=<id> spent=<n> limit=<m> pct=<p>` per LLM call
- `[llm-budget:warn] college=<id>` on threshold crossing
- `[llm-budget:blocked] college=<id>` on 429 response
- `[llm-budget:weekly] college=<id> spent=<n>` weekly cron output
- New admin dashboard widget (optional, deferred to v2): per-college current week + last 4 weeks bars
