# GATE 2 — Resolution Log

**Date:** 2026-05-14
**Validators:** arch-validator, data-validator, api-sec-validator
**Initial result:** FAIL
**After remediation:** PASS (all CRITICAL + HIGH addressed in spec §10)

## Findings → Resolution Map

| ID | Source | Severity | Finding | Resolved in spec |
|---|---|---|---|---|
| C-ARCH-1 / C-DATA-1 | arch, data | CRITICAL | `scoreRationale` missing on Inquiry | §10.1 — strict subdocument schema |
| C-ARCH-1 / C-DATA-3 | arch, data | CRITICAL | `lastScoredAt` missing for debounce | §10.1 — indexed Date field |
| C-ARCH-2 / C-DATA-2 | arch, data | CRITICAL | Audit action `ai_score_computed` not in enum | §10.4 — extend `AuditAction` + `AUDIT_ACTIONS` |
| C-ARCH-3 | arch | CRITICAL | Assignment-rule re-eval trigger unspecified | §10.9 — synchronous post-write call |
| C-ARCH-4 / H-DATA-5 | arch, data | CRITICAL/HIGH | LLM cap tracking has no home | §10.3 — new `LeadScoringStats` model; §10.7 — Redis atomic counter |
| C-API-1 | api-sec | CRITICAL | `admissions_admin` role doesn't exist | Story 4 AC#5 rewritten to use `authorize('admissions', 'update')` (existing personas) |
| H-ARCH-1 | arch | HIGH | Worker not yet registered | Phase 8 task — bootstrap call in admissions module index |
| H-ARCH-2 / H-API-2 | arch, api-sec | HIGH | LLM 12s timeout + idempotency mechanism unspecified | §10.6 + §10.8 — explicit AbortController + jobId dedup + worker-level debounce |
| H-ARCH-3 | arch | HIGH | Module boundary (admissions vs juvi) ambiguous | §10.10 — admissions owns scorer, juvi exposes LLM client only |
| H-DATA-4 | data | HIGH | Missing indexes on `leadScore`/`leadGrade`/`lastScoredAt` | §10.2 — three new compound indexes |
| H-DATA-6 | data | HIGH | Backfill plan for existing inquiries | §10.13 — runbook + one-time backfill update |
| H-API-3 | api-sec | HIGH | Rate-limit cap atomicity (Redis race) | §10.7 — `INCR` + `EXPIRE` + race rollback |
| H-API-4 | api-sec | HIGH | HTTP error codes undefined | §10.14 — explicit contract table |
| H-API-6 (escalated) | api-sec | MEDIUM→HIGH | PII masker not in shared module | §10.5 — extract to `shared/llm/pii.ts` |
| M-API-5 | api-sec | MEDIUM | `performedBy` lost in background rescores | §10.11 — propagate through job payload |
| M-ARCH-3 | arch | MEDIUM | `deriveLeadGrade` not exported | §10.12 — move to `lead-scoring/grade.ts`, re-export |
| M-ARCH-1, M-ARCH-2, M-ARCH-4, L-* | arch | MEDIUM/LOW | Schema strictness, batch cap edge case, prompt masking reference, stats shape | Folded into §10.1, §10.14, §10.5, §10.15 |
| M-DATA-7 | data | MEDIUM | LeadInteraction causation tracking | Deferred — not needed for MVP; logged for future |
| M-DATA-8 | data | MEDIUM | Service signature ambiguity | §10.10 + §10.11 settle: worker computes rationale, returns updated doc |

## Net additions to feature scope from GATE 2

- 1 new model (`LeadScoringStats`)
- 2 new Inquiry fields (`scoreRationale`, `lastScoredAt`)
- 1 audit-action enum extension
- 1 file move (`finance-agent/pii.ts` → `shared/llm/pii.ts`)
- 3 new compound indexes
- Specific Redis-counter + AbortController + jobId-dedup patterns

## Cost paid for GATE 2

- 3 parallel validator agents (Explore type) — research/read-only, no implementation work
- ~20 findings surfaced, all with code-level remediations
- Spec passes go from "feels complete" to "every NFR + edge case has a named mechanism and file location"

## GATE 2 verdict (post-remediation)

✅ **PASS** — All 6 CRITICAL and 9 HIGH findings have explicit, code-level remediations in spec §10. Spec is implementation-ready.
