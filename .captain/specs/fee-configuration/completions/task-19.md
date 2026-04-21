# Completion: Task 19 — API reference + QA/deploy checklist

**Feature:** fee-configuration
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Created
- `backend/docs/api/fee-configuration.md` — API reference (concepts, data model, pin lifecycle, endpoints, error codes, RBAC, integration behaviour, all 11 open questions with their current status)
- `backend/docs/api/fee-configuration-qa-checklist.md` — deploy checklist (prerequisites, data integrity pre-flight, schema + BullMQ infra, backfill with Finance sign-off gate, lateral-entry flip, observability, 6 smoke-test scenarios, rollback plan, known limitations, post-deploy monitoring, sign-off)

## Docs Coverage

### API reference (~12 sections)
1. Concepts (Pin, FSI, Commitment Sheet, Component Template)
2. Data model (all 4 new collections/fields + embedded subdoc)
3. Pin lifecycle diagram
4. 10 endpoints fully documented with request/response/errors
5. Error codes table
6. RBAC mapping table
7. Request/response shape references
8. Integration behaviour (admission, promotion, invoice generation, attribute-drift rebind)
9. All 11 open questions indexed with current status

### QA/deploy checklist (10 sections)
0. Prerequisites
1. Data integrity pre-flight (AY, FSI, Student.batchId, template seed)
2. Schema + BullMQ infrastructure verification
3. **Backfill (one-shot pre-rollout)** — DRY-RUN → Finance sign-off → --commit → per-college, with rollback contingency
4. Lateral-entry schema flip (T21 backfill + manual studyYearAtAdmission=2 for specific students)
5. Observability (dashboard metrics + alerts wiring + nightly snapshot verification)
6. End-to-end smoke tests (admission, promotion, rebind, transfer, PDF, invoice)
7. Rollback plan (data via T16 rollback + code via PR reverts + disable audit worker)
8. Known limitations (6 explicit caveats operators should know)
9. Post-deploy monitoring (first 2 weeks)
10. Sign-off (Finance Lead + SRE + Product + Principal)

## Violations
None.

## Notes
- Docs match the existing style in `backend/docs/api/campus-allocations.md` and `people-search.md` (same markdown conventions + section headers).
- API reference includes concrete sample JSON responses for each endpoint.
- QA checklist is executable — every item is a verifiable boolean that Finance/Ops can check off.
- Rollback plan explicitly distinguishes:
  - Data rollback (T16's rollback mode) — safe, narrowly scoped
  - Code rollback (PR revert) — use only if feature is catastrophically broken
  - Audit-worker disable — for resource-thrashing diagnosis only
- All 12 open questions + the 3 skipped T18 scenarios are explicitly documented as "known, non-blocking" so operators aren't surprised.
