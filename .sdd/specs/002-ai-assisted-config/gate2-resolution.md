# GATE 2 — Resolution Log

**Feature:** 002-ai-assisted-config
**Date:** 2026-05-14
**Validators reported:** arch-validator (PASS, 1 HIGH + 3 MEDIUM + 1 NOTE), api-sec-validator (PASS, 3 HIGH + 3 MEDIUM)
**data-validator:** did not report back before the user requested proceed; nudged via SendMessage; folded its findings post-hoc if they arrive.

**Initial verdict:** PASS (no CRITICAL).
**Post-remediation verdict:** PASS — all HIGH + MEDIUM findings have explicit remediations in spec §10.

## Findings → Resolution Map

| ID | Source | Severity | Finding | Resolved in spec |
|---|---|---|---|---|
| A-HIGH-1 / AS-HIGH-1 | arch, api-sec | HIGH | Cap-guard hardcodes namespace; not reusable | §10.1 — parameterize `tryClaimLLMSlot` with optional `namespace` arg |
| AS-HIGH-2 | api-sec | HIGH | HTTP response contract underspecified | §10.2 — explicit code/body table |
| AS-HIGH-3 | api-sec | HIGH | `FieldChange.source` missing — audit cannot distinguish AI vs UI | §10.3 — extend `FieldChange` with optional `source: 'ui'|'ai'|'import'` |
| A-MED-1 | arch | MEDIUM | `aiSuggestable` flag location | §10.4 — added to `ConfigField` interface |
| A-MED-2 | arch | MEDIUM | Module boundary ambiguity | §10.5 — `modules/platform/config-suggest/` with service/prompt/parser/cap-guard |
| A-MED-3 | arch | MEDIUM | `AuditAction` extension needed | §10.6 — `ai_config_suggested` + `ai_config_applied` in union + array |
| AS-MED-4 | api-sec | MEDIUM | Filter sensitive fields BEFORE LLM prompt | §10.7 — explicit ordered sequence |
| AS-MED-5 | api-sec | MEDIUM | PII masker context shape unclear | §10.8 — collegeProfile shape locked to non-PII metadata + defensive maskPII |
| AS-MED-6 | api-sec | MEDIUM | Stats aggregation multi-tenancy | §10.9 — `collegeId` `$match` as first pipeline stage |
| A-NOTE | arch | NOTE | Story 2 accept/reject — no new routes | §10.10 — frontend tracks state, upsert handler batch-updates suggestion status |
| AS-2-idempotency | api-sec | (mentioned) | Idempotency for repeat suggest | §10.11 — 30s `isDuplicate` check |

## Cost paid

- 3 parallel validators (Explore) on the 002 spec. Two responded; one (data-validator) was nudged but didn't respond before user said proceed.
- ~10 findings actionable, all with code-level remediations.

## Open thread

If `data-validator` returns with anything material (e.g., schema gaps in `ConfigSuggestion`, missing indexes), I'll re-open this resolution and patch §10 before Phase 8 begins. Otherwise the spec is implementation-ready.

## Update — data-validator returned PASS (4 warnings) mid-Wave-1

After Wave 1 of Phase 8 was already in flight, data-validator's report landed (`gate2-data-layer.md`). All 4 warnings non-blocking. Three are folded into Wave 2 via spec §10.12; one (FieldChange.metadata extensibility) is logged as Phase B since Wave 1 already shipped the stricter `source` discriminator per api-sec recommendation.

| Data-validator item | Severity | Resolution |
|---|---|---|
| `source` enum constraint on ConfigSuggestion | warning | §10.12 — `enum: ['llm', 'peer-default'], required: true` in the Mongoose schema; folds into Wave 2 |
| Cost-fraction strategy explicit | warning | §10.12 — equal division (`costInr = batchCost / N`); folds into Wave 2 service |
| `{batchId: 1}` index | warning | §10.12 — added to the model in Wave 2 |
| `FieldChange.metadata` extensibility | warning | Phase B deferred. Wave 1 shipped the stricter `source` field; metadata can come later if a new per-field provenance dimension is needed. |
