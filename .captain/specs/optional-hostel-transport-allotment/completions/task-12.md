# Completion: Task 12 — Admission workflow rewire

**Feature:** optional-hostel-transport-allotment
**Completed:** 2026-04-18
**Person:** srinikandula
**Final Status:** Done

## Implementation
- `workflow.handlers.ts` lines 1167–1251 rewired
- Feature-flag gate via `isOptionalAllotmentEnabled()`: when on, calls `proposeHostelAllocation` / `proposeTransportAllocation` (service layer with full audit/notification/TTL); when off, legacy direct-active path unchanged.
- Idempotency: existing allocations in `{proposed, waitlisted, active, vacate_requested}` short-circuit the step (no duplicate proposal).

## Test Results
- Full suite: 171/171 (no regression in admission workflow tests)
- Typecheck clean

## Spec Gaps
- No direct tests added for the flag-on admission path (relies on service-layer tests for correctness).
