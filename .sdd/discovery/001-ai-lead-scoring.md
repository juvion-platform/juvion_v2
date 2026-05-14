# Discovery — AI Lead Scoring (M01 Admissions)

**Feature:** 001-ai-lead-scoring
**Date:** 2026-05-14
**Scope decision:** Admissions inquiries only (M01). Hybrid rules + LLM scoring.

## What already exists (we extend, not invent)

| Surface | State | File |
|---|---|---|
| `Inquiry.leadScore` (0–100) + `leadGrade` (hot/warm/cold/dormant) | Schema present | `backend/src/models/admissions/Inquiry.ts` |
| W01 workflow `lead_score` step handler (consumes external score) | Wired, expects external compute | `backend/src/modules/admissions/workflow.handlers.ts:66` |
| `deriveLeadGrade(score)` threshold mapping (≥80 hot, ≥60 warm, ≥40 cold, else dormant) | In use | `workflow.handlers.ts` |
| `AssignmentRule` can route on `leadScore`/`leadGrade` operators | Active | `backend/src/models/admissions/AssignmentRule.ts` |
| BullMQ `QUEUE_NAMES.LEAD_SCORING = 'admissions:lead-scoring'` | Reserved, no worker | `backend/src/shared/queue/QueueManager.ts` |
| LLM client (Claude/OpenAI), cost tracking, masked-PII prompts | Production-ready | `backend/src/modules/juvi/finance-agent/llm-client.ts`, `prompts.ts` |
| Audit log with semantic actions | Reusable | `backend/src/shared/audit.ts` |
| `LeadInteraction` history (calls, WhatsApp, AI convo, outcomes) | Rich signal source | `backend/src/models/admissions/LeadInteraction.ts` |
| Admissions list + CRM dashboard pages | Extensible columns | `admin-portal/src/pages/admissions/InquiriesPage.tsx`, `CRMDashboardPage.tsx` |

## What's missing (this feature builds it)

1. Rule-based feature scorer (deterministic component)
2. LLM qualitative scorer (calls Juvi LLM client with masked context)
3. Score blender (combines rule + LLM weight → 0–100)
4. BullMQ worker on `admissions:lead-scoring` queue
5. Service API: score one inquiry, batch score, retrieve last score + rationale
6. Score rationale storage (factor breakdown for transparency/audit)
7. Frontend: score badge on InquiriesPage rows, score detail card on inquiry modal
8. Score recompute trigger: on Inquiry create, on LeadInteraction add, manual button
9. Per-college rate limit / cost guard for LLM calls

## Key conventions to honor

- Multi-tenant `collegeId` first arg everywhere
- `AppError(statusCode, message)` ordering
- `createAuditLog()` for every score write
- Zod validation, paginate helper, service/controller/routes pattern
- LLM cost tracked via existing `LLMResponse.costInr`
- PII masked before LLM (already standard in `prompts.ts`)
