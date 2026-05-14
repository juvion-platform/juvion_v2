# Admissions CRM Depth (Strategic Gap 5)

**Source:** `Juvion_vs_CampX_Strategic_Comparison.pdf` §4.5 — "PARITY REQUIRED on the data model. v1.0."

## What was MISSING vs CampX

The comparison doc tagged 8 specific data-model gaps:
1. **5 UTM fields** — source, medium, campaign, term, content
2. **Lead score** + MQL/SQL classification on prospect statuses
3. **Communication-enablement flags** + email/mobile verification + payment-completion verification
4. **27 prospect statuses** (Juvion: 9 on Inquiry)
5. **16 application statuses** (Juvion: 11 on Applicant)
6. **7 admission statuses** (Juvion has the entity but minimal status state machine)
7. **Assignment-rule routing engine** (Juvion: free-text `assignedTo` string)
8. **Cluster-head hierarchy within officer tier** (not modelled)

## What we already had

After surveying the codebase, the **4-entity funnel split** the doc recommended already exists:
- `Inquiry` — Lead/Prospect equivalent
- `LeadInteraction` — touchpoint log
- `Applicant` — Application equivalent
- `Admission` — Admission equivalent

So **no new entities are needed**. The gap is purely depth on existing entities — exactly the kind of focused L3 decomposition the doc called for.

## Acceptance criteria (Phase A — this session)

1. UTM source attribution on Inquiry: `utmSource`, `utmMedium`, `utmCampaign`, `utmTerm`, `utmContent`. Captures the marketing-channel funnel source the institution paid to acquire the lead through.
2. **MQL/SQL classification** on Inquiry, separate from the existing `leadGrade` (which is hot/warm/cold). MQL = Marketing Qualified Lead. SQL = Sales Qualified Lead. Disqualified = explicit no.
3. **Verification flags** on Inquiry: `emailVerified`, `mobileVerified`. On Applicant: `applicationFeeVerified`. These are admin-gated booleans the marketing team flips after confirming the prospect.
4. **Assigned officer** as a real `Person` ref on Inquiry (not the existing `assignedTo` free string). Plus an explicit `clusterHeadId` ref for the within-tier hierarchy CampX models.
5. **Status taxonomy depth** — expand Inquiry status from 9 → 27 values and Applicant status from 11 → 16 values, matching CampX's funnel-stage granularity. Keep all existing values backward-compatible.
6. **AssignmentRule model** — admin-defined policies that route new inquiries to officers based on source / score / programme interest. Rules are configurable from the platform UI, not code.
7. Validation schemas updated for every new field (the silent-Zod-strip lesson).
8. Service-layer create/update wires every new field through.

## Phased breakdown

### Phase A — Data-model floor (this session)
- Inquiry: UTM, MQL/SQL, emailVerified, mobileVerified, assignedOfficerId, clusterHeadId, expanded status enum.
- Applicant: applicationFeeVerified, expanded status enum, prospect-grade carry-forward.
- New `AssignmentRule` model + CRUD service + routes.
- Validation + service updates.
- Frontend: extend ApplicantsPage + InquiryFormPage to surface the new fields (collapsible "CRM" section). Keep the surface compact; full CRM dashboard is Phase B.

### Phase B — CRM dashboard + AI scoring
- Dedicated CRM dashboard view: pipeline by status, conversion funnel, per-officer KPIs.
- AI lead-scoring agent (the doc's differentiation opportunity §4.5). Trained per-institution rather than rule-based.
- AI conversion prediction at the prospect stage.
- Assignment rules with cascading conditions (source AND score AND programme).

### Phase C — Cluster hierarchy + officer tier
- Officer tier model with cluster-head links.
- Aggregation views: cluster head sees their cluster's pipeline, individual officers see their own.
- Push notifications when cluster targets are missed (per the doc's "push beats pull" thesis).

## Non-functional criteria

- **Backward compatible** — every new field is optional. Existing rows continue to load and save without the new data. Existing status values stay valid; the enum only EXPANDS.
- **No new dependencies.**
- **Single canonical status enum per entity** — no v1/v2 enum coexistence (same lesson as the quota-enum cleanup).

## Out of scope for Phase A

- The 7-status Admission state machine (Admission entity already exists but with a different shape — `admissionType` + `provisioningStatus`. CampX's "7 admission statuses" overlap with provisioning. Deferred.)
- AI scoring / conversion prediction (Phase B).
- CRM dashboard (Phase B).
- Cluster-aggregation views (Phase C).
