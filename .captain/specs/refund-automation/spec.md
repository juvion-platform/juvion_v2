# Spec: Automated Refund on Hostel / Transport Vacate

**Feature slug:** `refund-automation`
**Owner:** TBD
**Phase:** 1 — Specify (draft — defaults picked via captain-spec `recommend`; pending user review)
**Created:** 2026-04-18
**Prereq:** `optional-hostel-transport-allotment` feature complete

---

## 1. Problem Statement

When a student vacates a hostel or cancels a transport allocation mid-year, the existing feature (PR #15) flags `HostelClearance.duesCleared = false` to signal "fee settlement needed" — but the actual refund calculation is manual. Finance teams pull a report each week and compute pro-rata refunds by hand. This is slow, error-prone, and inconsistent across colleges (each accountant has their own slab logic).

This feature automates refund calculation on `vacate_approve` / `approveCancelTransport`, producing a `Refund` record linked to the paid `FeeLineItem`s, using a configurable policy per college.

## 2. Goals

- Compute refund amount deterministically at vacate-approve time based on configured policy
- Create `Refund` records (existing model) and link them to the vacated allocation + source `FeeLineItem`
- Support three policies out of the box: `none`, `pro_rata_monthly`, `pro_rata_daily`
- Allow colleges with custom slabs to define a `slab_based` policy via `CampusConfig`
- Produce an auditable trail: refund amount, policy used, inputs (enrolled days, AY length, amount paid)

## 3. Non-Goals

- **Refund disbursement** — actually moving money out (bank transfer, cheque, reversal) is finance-side and remains manual in v1. This feature creates the `Refund` record; disbursement happens downstream.
- **Deposit refunds** — handled separately via `depositRefund` field on `HostelAllocation` (already there, set at vacate by warden). Not part of this pro-rata feature.
- **Damage charge deductions** — the `damageCharges` field exists on `HostelAllocation`. Refund calculation *does* consider it (subtract from the gross refund), but damage assessment is still warden-manual.
- **Refunds on declined / expired / withdrawn** — no money paid means no refund. Feature only triggers on `active → vacated/cancelled` path.
- **Tax/GST reversal** — out of scope for v1.

## 4. User Journeys

### 4.1 Student vacates mid-year (typical case)

1. Student accepted hostel on 2026-07-01 (AY runs 2026-07-01 to 2027-06-30, 365 days)
2. Paid `hostel_fee` of ₹ 60,000 on acceptance
3. Student requests vacate on 2026-12-31 (183 days enrolled, 182 unused)
4. Warden approves vacate on 2027-01-05
5. `approveVacateHostel` runs, invokes the new refund helper
6. Helper reads `CampusConfig.refund.hostel.policy = 'pro_rata_daily'`
7. Computes refund: 60,000 × (182/365) = ₹ 29,918. Subtracts damage ₹ 2,000 = ₹ 27,918
8. Creates `Refund { amount: 27918, feeLineItemId, allocationId, policy: 'pro_rata_daily', status: 'pending_disbursement', computedAt: now, breakdown: {...} }`
9. Student sees refund amount on their fee page; finance gets notification to process

### 4.2 College with "no refund" policy

1. `CampusConfig.refund.hostel.policy = 'none'`
2. Vacate approval completes, but no `Refund` record is created
3. `HostelClearance.duesCleared` is still set (legacy behavior)
4. Student fee account unchanged

### 4.3 Slab-based policy

1. `CampusConfig.refund.hostel.policy = 'slab_based'` with slabs `[{ daysEnrolled: 30, refundPct: 80 }, { daysEnrolled: 90, refundPct: 50 }, { daysEnrolled: 365, refundPct: 0 }]`
2. Student vacates at day 60 → falls in second slab → 50% refund
3. Record carries the matched slab for audit

### 4.4 Transport cancellation

1. Same flow, parameterized by flow. Config path `CampusConfig.refund.transport.policy`. Component `'transport_fee'` instead of `'hostel_fee'`.
2. No damage-charges concept on transport.

## 5. Acceptance Criteria

### 5.1 Configuration

- AC-01: `CampusConfig.refund.hostel` sub-doc: `policy: 'none' | 'pro_rata_monthly' | 'pro_rata_daily' | 'slab_based'` (default `'none'`), `slabs: [{ daysEnrolled, refundPct }]` (required when policy='slab_based'), `includeDamageDeduction: boolean` (default `true`).
- AC-02: `CampusConfig.refund.transport` sub-doc with same shape minus `includeDamageDeduction`.

### 5.2 Refund calculation

- AC-03: New service `computeAllocationRefund(flow, collegeId, allocationId)` returns `{ amount, policy, breakdown: { paidAmount, enrolledDays, totalDays, refundPct, damageDeduction }, warnings: [] }`.
- AC-04: `policy='none'` → amount=0, no further action.
- AC-05: `policy='pro_rata_monthly'` → `amount = paidAmount × (unusedMonths / totalMonths)`. Months computed as whole calendar months from vacate date to AY end.
- AC-06: `policy='pro_rata_daily'` → `amount = paidAmount × (unusedDays / totalDays)`. `unusedDays = acceptedOnDate + (totalDays − enrolledDays)`.
- AC-07: `policy='slab_based'` → find the smallest slab where `enrolledDays ≤ slab.daysEnrolled`, apply `slab.refundPct`. If no slab matches, refund = 0.
- AC-08: `includeDamageDeduction=true` → subtract `HostelAllocation.damageCharges` from the computed amount. Never goes negative.
- AC-09: Amount rounded to 2 decimals (rupee + paise). Never exceeds `paidAmount`.

### 5.3 Integration

- AC-10: `approveVacateHostel` (existing service from optional-allotment PR) calls `computeAllocationRefund` at the end of the transaction. If amount > 0, creates a `Refund` record with `status: 'pending_disbursement'`.
- AC-11: `approveCancelTransport` same treatment.
- AC-12: If refund computation errors (e.g. can't find matching FeeLineItem), log warning and still allow vacate to succeed. Don't block the primary flow on a refund bug.
- AC-13: `HostelClearance.duesCleared` (pre-existing) stays at `false` until finance marks the `Refund` as disbursed — preserves legacy signaling.

### 5.4 API

- AC-14: `GET /api/finance/refunds/preview?allocationId=...&flow=hostel|transport` — returns the refund calc *without* creating a record. Used by the UI modal that warden sees at approve-vacate time ("this will generate a ₹ 27,918 refund — proceed?").
- AC-15: `GET /api/finance/refunds?status=pending_disbursement&limit=N` — finance queue view (already exists per existing Refund model; confirm filter supports `status`).

### 5.5 Observability

- AC-16: Each refund creation emits a structured log: `{ event: 'refund_computed', collegeId, allocationId, flow, amount, policy }`.
- AC-17: Audit entry with `action: 'create'` on `Refund` entity (fits existing AuditAction union).

## 6. Data Model

Uses the existing `backend/src/models/finance/Refund.ts` model. Requires inspection during planning to confirm fields. Likely additions (to be confirmed in plan):
- `policy: string` — captures which policy ran
- `breakdown: Mixed` — calculation inputs for auditability
- `allocationId?: ObjectId` — link back to hostel/transport allocation

## 7. Edge Cases

- **EC-1** Student vacates on day 0 (same day as accept) → full refund if policy is pro-rata, else per-slab.
- **EC-2** Student vacates after AY end → 0 unused days → 0 refund. Log a warning.
- **EC-3** Fee line item has `paidAmount < amount` (partial pay) → refund based on `paidAmount`, not `amount`.
- **EC-4** Multiple FeeLineItems for the same component (rare but possible — adjustments) → sum paidAmounts, compute single refund record referencing all of them.
- **EC-5** Slab policy with no matching slab → 0 refund + warning.
- **EC-6** `damageCharges > grossRefund` → net refund = 0 (not negative).
- **EC-7** Vacate rejected then re-requested → previous (rejected) flow did not create a refund, nothing to clean up.

## 8. Dependencies

- Existing: `HostelAllocation`, `TransportAllocation`, `FeeLineItem`, `Refund`, `HostelClearance`, `CampusConfig`, `AuditLog`, `allocation-lifecycle`
- New: `CampusConfig.refund` sub-doc, service file `modules/finance/refund-calculator.ts`, hooks into `approveVacateHostel` / `approveCancelTransport`
- External: None (no bank API integration)

## 9. Success Metrics

- M-1: 100% of `active → vacated/cancelled` transitions with policy≠`'none'` produce a `Refund` record (alarm on miss)
- M-2: Median refund amount variance between automated and manual calculation < 1% (spot check by finance during first month)
- M-3: Finance team time-to-process refunds drops by > 50% (measured via refund-queue turnaround)

## 10. Open Questions

- OQ-1: Should the preview endpoint be callable by the student (self-service "if I vacate today, what's my refund?") or admin-only? Default: admin-only for v1; student preview is a nice-to-have.
- OQ-2: Slab boundaries — inclusive or exclusive? e.g. if a slab says `daysEnrolled: 30`, is day 30 in this slab or the next? Default: inclusive (day ≤ boundary matches).
- OQ-3: `pro_rata_monthly` month count — calendar month (Jan 15 → Feb 15 = 1 month, partial month counted as 1) or days-based conversion (30.44 days/month average)? Default: calendar-month with partial = 1 full month.
- OQ-4: If a student's fee was paid via multiple payments (Payment collection), does the refund split proportionally? Default: lump refund to the primary FeeLineItem; finance handles Payment-level reversal manually.

## 11. Changelog

- **2026-04-18** — Initial draft via captain-spec `recommend` defaults. Pending interview with the feature owner to confirm choices.
