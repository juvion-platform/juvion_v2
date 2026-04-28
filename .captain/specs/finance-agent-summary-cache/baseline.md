# LLM Cost Baseline (pre-cache)

This file records the **before** numbers for the finance-agent-summary-cache feature so the success metric (≥ 80% LLM cost reduction) is verifiable.

Re-run weekly during build-out and once after the deploy week. Compare runs to compute the savings %.

```
npx ts-node backend/src/scripts/measure-llm-baseline.ts --days=7
```

---

## Run 1 — Initial baseline (dev DB)

**Captured:** 2026-04-28 12:00 UTC
**Window:** 2026-04-21 06:34 UTC → 2026-04-28 06:34 UTC (7 days)
**Environment:** local dev (`mongodb://localhost:27017/juvion_v2`)
**Provider:** Claude Sonnet 4.5
**Source:** `AgentAction` collection

### Per-college / per-type

| College | Type | Calls | Cost (INR) |
|---|---|---:|---:|
| Juvion Institute of Technology | forecast | 32 | ₹6.4871 |
| Juvion Institute of Technology | situations | 16 | ₹32.3769 |
| Juvion Institute of Technology | reminder-draft | 4 | ₹3.6067 |
| Juvion Institute of Technology | chat | 2 | ₹1.7924 |
| Juvion Institute of Technology | reminder-approve | 1 | ₹0.0000 |
| Juvion Institute of Technology | risk | 1 | ₹0.1091 |

### Per-type rollup

| Type | Calls | Cost (INR) | Cache-target? |
|---|---:|---:|---|
| forecast | 32 | ₹6.4871 | **YES** (Tier 1) |
| situations | 16 | ₹32.3769 | **YES** (Tier 1) |
| reminder-draft | 4 | ₹3.6067 | No (deferred) |
| chat | 2 | ₹1.7924 | No (per-prompt cache, separate optimization) |
| reminder-approve | 1 | ₹0.0000 | No (no LLM call — just persists drafts) |
| risk | 1 | ₹0.1091 | **PARTIAL** (top-20 cron) |

**Total:** 56 calls / ₹44.3722 / in=35,158 out=27,770 tokens

### Cache-target subtotal (forecast + situations + risk)

49 calls / ₹38.9731 / **88% of total cost** sits on the three call sites we plan to cache. Confirms the design: caching these three covers the cost majority.

---

## Notes on the dev-baseline numbers

- Single college (Juvion Institute of Technology), low-volume usage
- `situations` cost-per-call (₹2.02) is ~10× `forecast` cost-per-call (₹0.20) — situations prompts are larger (the candidate set + JSON output tokens), so the cache's value is disproportionately high here
- `chat` is per-officer-prompt — won't be cached in this feature, but Anthropic prompt caching could reduce input cost
- These are warm-up numbers; production deploys will see 10–100× the call volume. The savings ratio should hold.

---

## Run 2 — TBD (week 2 of build-out)

_Re-run after C1-C9 are mid-build but cron not yet enabled. Drift expected to be small (steady-state usage)._

## Run 3 — TBD (after deploy week)

_Re-run after the cache cron has been on for one full week. Compute:_

```
savings % = 1 - (totalCostInr_run3 / totalCostInr_run1)
```

_Target: ≥ 80% savings on the 3 cache-target call sites._

---

## Reproducibility

The script is deterministic given a fixed window. Each weekly re-run uses the SAME window length (7 days) but a different end-date. To compare runs cleanly:

1. Ensure the dev DB has steady-state usage (don't compare a heavily-loaded week vs. a quiet one)
2. Use the same `--days` value across runs
3. Capture both the run 1 and run 3 outputs side-by-side in the deploy memo
