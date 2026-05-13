# Faculty Profile Depth & NAAC Alignment (Strategic Gap 1)

**Source:** `Juvion_vs_CampX_Strategic_Comparison.pdf` §4.1 — "PARITY REQUIRED — single largest gap."

## Why this matters

Faculty Profile is the **single most populated entity at CampX** (663 cumulative form fields across the workspace). It's also the artifact a Principal demonstrates to NAAC assessors — the buyer at every B.Tech engineering college we'll sell into.

If Juvion's Faculty Profile is shallower than CampX's, the pitch is *disqualified on commodity capability* in the second sales meeting — before any Juvion advantage (push architecture, AI-native, ERP+Juvi) gets airtime.

## What CampX has that Juvion does not

1. **34 external credential ID fields** on the Faculty entity (AICTE, AISHE, Shodhganga, Swayam, NPTEL, NPTEL-Learner, ATAL, IRINS, Vidwan, ORCID, Scopus, Web of Science, ResearchGate, Google Scholar, ResearcherID, Clarivate, Academia, Semantic Scholar, Publons, SSRN, Elsevier Reviewer, Springer Reviewer, GitHub, HackerRank, HackerEarth, LeetCode, Replit, CodeChef, Exercism, Codecademy, LinkedIn, YouTube, personal website).
2. **34 has-many sub-collections** under Faculty (publications, patents, projects, fellowships, exchange programmes, professional memberships, outreach activities, professional development, digital learning contributions, awards, teaching loads, examination duties, etc.).
3. **NAAC-shaped fields on research-output entities** (publications, patents, projects): indexing service (Scopus / WoS / UGC-CARE), journal quartile (Q1–Q4), impact percentile, level (international / national / regional), Sustainable Development Goal mapping, author position.
4. **`verificationStatus` workflow on 6 external sub-collections** — fellowships, exchange programmes, professional memberships, outreach activities, professional development, digital learning contributions. External claims default to `null` and must be approved by an administrator. Internal claims (teaching loads, exam duties, in-house experience) do not.

## What Juvion has today

`backend/src/models/people/Faculty.ts` — **7 fields** total: `employeeCode`, `designation`, `specialization`, `qualification`, `departmentId`, `contractType`, `status`. Order-of-magnitude gap.

## Acceptance criteria

A Juvion Faculty Profile shall:
- Carry all 33 external credential IDs CampX models (one missing from doc's count — see §AC-IDs).
- Support all 34 has-many sub-collections, even if only a subset are wired with full NAAC fields in v1.0.
- On every NAAC-mappable research output, capture: indexing service, quartile (where applicable), impact percentile, level, SDG mapping, author position.
- On every external-participation record (the 6 sub-collections above), default `verificationStatus = null`; expose an admin-approval action that flips it to `approved` with timestamp + actor.
- Be edited via a tabbed form (Profile / Academic / Research IDs / Publications / Patents / … / Other) — mirroring the Student form pattern.
- Be displayed on a tabbed detail page in the same shape.

## Non-functional criteria

- Single canonical entity (`Faculty`) — **no `Faculty-v1 / Faculty-v2` migration coexistence**. CampX's tech-debt anti-pattern (caste-v1/v2, ExamsWeb/ExamsWebV2) is exactly what we must avoid (§8 of the comparison doc).
- All 33 IDs are optional. No regex validation in v1 (defer to AI verification agent in v2 — §AG-XX in the doc).
- Backward compatible: existing Faculty records continue to work; new fields default empty.

## Phased breakdown

### Phase A — Identity floor (this session)
- **Faculty model**: nested `externalIds` sub-document with 33 string fields, grouped logically in TS but flat at the Mongo doc level.
- **Validation**: Zod schema accepts optional `externalIds` object; any unknown sub-keys stripped (per the Zod-strip lesson from the branchId bug).
- **FacultyFormPage**: tabbed UI (Profile / Academic / Research IDs). Research IDs tab groups the 33 fields into 5 visual sections (Indian regulators, International research, MOOC/learning, Code platforms, Social & web).
- **FacultyDetailPage**: tabbed read-only mirror with the same grouping.
- **Seed**: don't bulk-seed external IDs in `seed.ts`; faculty get blank IDs until admin enters them. (Optional follow-up: add 2–3 example IDs per faculty in the demo seed.)

### Phase B — Research outputs (Publications + Patents + Projects)
- New models: `FacultyPublication`, `FacultyPatent`, `FacultyProject` under `models/people/`.
- Each carries the NAAC field set (indexing, quartile, impact percentile, level, SDG mapping, author position).
- CRUD endpoints under `/api/people/faculty/:id/publications`, `/patents`, `/projects`.
- New panel on FacultyDetailPage per type, mirroring StudentFeeStructurePanel composition.
- Bulk-import support deferred to BULKIMP (Gap 2).

### Phase C — External participation + verification workflow
- New models for the 6 verification-required sub-collections: `FacultyFellowship`, `FacultyExchangeProgramme`, `FacultyProfessionalMembership`, `FacultyOutreachActivity`, `FacultyProfessionalDevelopment`, `FacultyDigitalLearningContribution`.
- Each carries `verificationStatus: 'pending' | 'approved' | 'rejected' | null`, `verifiedAt`, `verifiedBy`, `verificationNotes`.
- Admin-approval endpoint per type.
- UI: "needs verification" badge + list view, approval modal.

### Phase D — Internal participation + remaining sub-collections
- Teaching loads, examination duties, work experience at home institution, awards, etc. — no verification workflow; just CRUD.
- ~20 remaining sub-collections; lower priority because they don't gate the NAAC pitch.

### Phase E — NAAC report generation + AI verification agent (v2)
- M10 Compliance generates the NAAC evidence report by querying the populated Faculty Profile.
- AI verification agent (Juvi sub-agent, suggested code `AG-FACULTY-VERIFY`) cross-references public sources (ORCID API, Scopus author API, ResearchGate scrape) and proposes `verificationStatus = approved` for review.

## §AC-IDs — The 33 external credential IDs

Grouped per the spec's tab structure:

**Indian regulators / portals (5):**
`aicte`, `aishe`, `shodhganga`, `irins`, `vidwan`

**International research (12):**
`orcid`, `scopus`, `webOfScience`, `researchGate`, `googleScholar`, `researcherId`, `clarivate`, `academia`, `semanticScholar`, `publons`, `ssrn`, `elsevierReviewer`

**Editorial / review identifiers (1):**
`springerReviewer`

**MOOC / learning (4):**
`swayam`, `nptel`, `nptelLearner`, `atal`

**Code platforms (8):**
`github`, `hackerRank`, `hackerEarth`, `leetCode`, `replit`, `codeChef`, `exercism`, `codecademy`

**Social & web (3):**
`linkedIn`, `youtube`, `website`

Total: **33** (doc says 34 — likely off-by-one in the source text or a missing platform).

## Out of scope for v1

- Regex validation per credential format (defer to AI agent).
- Auto-population from ORCID / Scopus API (Phase E).
- NAAC report PDF rendering (Phase E).

## Success metric

After Phase A: an admin can open a faculty member's edit form, switch to the Research IDs tab, enter their ORCID / Scopus / GitHub / etc., save, and see those IDs persisted + rendered on the detail page. The 33 IDs are queryable directly via the Faculty GET endpoint with no schema changes needed downstream.

After Phase B+C: a Principal can demonstrate the full Faculty Profile to a NAAC assessor — populated with publication metadata, patents, and verified external participations.
