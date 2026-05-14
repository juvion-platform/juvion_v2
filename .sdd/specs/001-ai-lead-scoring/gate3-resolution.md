# GATE 3 — Resolution Log

**Date:** 2026-05-14
**Initial result:** PASS with 3 BLOCKING + 3 MINOR corrections
**Post-fix result:** PASS — plan + tasks updated, ready for Wave 1

| ID | Finding | Resolution |
|---|---|---|
| B-1 | `deriveLeadGrade` returns 3 grades, not 4 (no 'dormant') | `plan.md` §C grade.ts row + `tasks.md` 2.1 rewritten: new thresholds (≥80 hot, ≥60 warm, ≥40 cold, else dormant). Acknowledged behavior change for scores 0–59. |
| B-2 | `QueueManager.addJob()` lacks `jobId` option for BullMQ dedup | New `tasks.md` Wave 1 Task 1.0 — extend `addJob` opts with `jobId?: string`. Plan §A row added. |
| B-3 | Worker bootstrap location: `admissions/index.ts` is thin, no init hook | Plan §D updated: worker.ts calls `registerQueue` at module-load; `app.ts` adds side-effect import (matches existing pattern). |
| M-1 | Test runner is Vitest, not Jest | Plan + tasks updated: `rtk vitest` instead of `rtk jest`. Vitest syntax is Jest-compatible — no test rewrites needed. |
| M-2 | `ioredis-mock` missing from devDeps | Added to Wave 1 Task 1.0 prereqs. |
| M-3 | LeadInteraction created in `workflow.service.ts`, not `intake-service.ts` | Plan §D and tasks.md 4.4 corrected to target `workflow.service.ts`. |

## Additional facts confirmed by audit (folded into plan)

- PII masker exports are `maskPII()` + `unmaskText()` (NOT `unmaskPII`). Token format `{category_ordinal}` (e.g. `{email_1}`).
- Redis singleton at `backend/src/config/redis.ts` → `import redis from '../../config/redis'`.
- `applyAssignmentRulesOnCreate(collegeId, inquiryPayload): Promise<IAssignmentRule | null>` — exact signature; the refactored `applyAssignmentRules` will have the same shape but accept a full `IInquiry`.
- W01 'lead_score' handler at `workflow.handlers.ts:66` — currently does `Inquiry.findByIdAndUpdate({$set: { leadScore, leadGrade }})` if the handler `result` object includes them. Plan §D replaces this with a call to `scoreInquiry()`.
- `pii.ts` importers: `juvi/finance-agent/service.ts`, `juvi/finance-agent/__tests__/pii.test.ts`. These two files must be updated when the file moves.

## Ready for Wave 1

All blocking findings resolved in the planning docs. Implementation can begin.
