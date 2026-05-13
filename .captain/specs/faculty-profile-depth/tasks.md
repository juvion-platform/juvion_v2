# Faculty Profile Depth — Task DAG

## Phase A — Identity floor

### A.1: Extend Faculty model with `externalIds` sub-document
**Status:** Ready
**Files:**
- `backend/src/models/people/Faculty.ts` — add nested `externalIds` schema with 33 optional string fields
**Acceptance:** Mongoose persists `externalIds` payload; existing records load with `externalIds = undefined`; new records can save full or partial ID sets.

### A.2: Extend `createFacultySchema` to accept `externalIds`
**Status:** Ready (depends: A.1)
**Files:**
- `backend/src/modules/people/validation.ts` — add `externalIdsSchema = z.object({ aicte: z.string().optional(), ... }).optional()` to `createFacultySchema`
**Acceptance:** PUT /api/people/faculty/:id with `externalIds: { orcid: "0000-..." }` persists the value and round-trips on GET.

### A.3: Tabbed FacultyFormPage (Profile / Academic / Research IDs)
**Status:** Ready (depends: A.2)
**Files:**
- `admin-portal/src/pages/people/FacultyFormPage.tsx` — restructure as 3-tab form; mirror StudentFormPage shape
**Acceptance:** Operator can fill any of the 33 external IDs across 5 visual sections on the Research IDs tab; save persists; reload shows them.

### A.4: Surface External IDs on FacultyDetailPage
**Status:** Ready (depends: A.1)
**Files:**
- `admin-portal/src/pages/people/FacultyDetailPage.tsx` — add a tab system + Research IDs panel
**Acceptance:** Read-only view shows only populated IDs (skip blank rows); grouped sections rendered.

### A.5: Verify + commit
**Status:** Ready (depends: A.3, A.4)
**Acceptance:** `npm run typecheck` clean. Manual curl: PUT externalIds → GET returns them. Browser: form save round-trip works.

---

## Phase B — Research outputs (next session)

### B.1: `FacultyPublication` model with NAAC fields
**Status:** Pending — superseded in part by Phase B1 (Bio & Office + generic FacultyDocument store).
**Notes:** Fields: `title`, `authors`, `authorPosition`, `journal`, `year`, `volume`, `issue`, `pages`, `doi`, `indexingService` (scopus|wos|ugcCare|none), `quartile` (Q1|Q2|Q3|Q4|null), `impactPercentile` (number), `level` (international|national|regional), `sdgMapping` (string[], multi-select from UN SDG 1–17).

### B.2: Publications CRUD service + routes
**Status:** Pending (depends: B.1)

### B.3: Publications panel on FacultyDetailPage
**Status:** Pending (depends: B.2)

### B.4: `FacultyPatent` model + CRUD + panel
**Status:** Pending

### B.5: `FacultyProject` model + CRUD + panel
**Status:** Pending

---

## Phase B1 — Bio + Office + generic document store (SHIPPED)

Added after the Phase B plan, before research-output sub-collections,
because credential evidence is the single highest-NAAC-impact
addition to the profile. See spec.md §Phase B1 (added in the same
commit).

### B1.1: Faculty model — `profileBio` + `office` sub-documents (DONE)
**Files:** `backend/src/models/people/Faculty.ts`
**Done:** added `profileBio` (summary, tagline, expertiseTags, researchInterests, teachingInterests, languages[]) + `office` (building, cabinNumber, phoneExtension, weeklyHours).

### B1.2: Faculty validation + service extensions (DONE)
**Files:** `backend/src/modules/people/validation.ts`, `service.ts`
**Done:** Zod schemas accept the new sub-documents; create + update services persist them.

### B1.3: `FacultyDocument` model — generic 12-category evidence store (DONE)
**Files:** `backend/src/models/people/FacultyDocument.ts`
**Done:** model with `category` (12-value enum), `documentType` (open string), `s3Key`, `mimeType`, `sizeBytes`, issuing metadata (`issuingAuthority`, `issuedAt`, `validUntil`, `referenceNumber`), `verificationStatus` (pending/approved/rejected), OCR slots, soft-delete via `archivedAt`. Indexes: `(collegeId, facultyId, category, archivedAt)` for list view + `(collegeId, verificationStatus, archivedAt)` for the admin queue.

### B1.4: `faculty-document-service` (DONE)
**Files:** `backend/src/modules/people/faculty-document-service.ts`
**Done:** list / get / view-URL / upload / update-metadata / archive. S3 upload uses `entityUploadPrefix('faculty', cid, fid)` under `documents/<docId>.<ext>`. Multi-tenancy: every operation calls `loadFacultyScoped` first. S3 best-effort cleanup on partial DB failure.

### B1.5: `faculty-document-controller` + multer + 5 routes (DONE)
**Files:** `backend/src/modules/people/faculty-document-controller.ts`, `routes.ts`
**Done:**
- `GET    /api/people/faculty/:facultyId/documents`
- `POST   /api/people/faculty/:facultyId/documents` (multipart 'file' + metadata)
- `GET    /api/people/faculty/:facultyId/documents/:docId`
- `GET    /api/people/faculty/:facultyId/documents/:docId/view` → presigned URL, 5-min TTL
- `PATCH  /api/people/faculty/:facultyId/documents/:docId`
- `DELETE /api/people/faculty/:facultyId/documents/:docId` → soft archive

### B1.6: Frontend service + UI (DONE)
**Files:** `admin-portal/src/services/faculty-documents.ts`, `pages/people/FacultyFormPage.tsx`, `FacultyDetailPage.tsx`, `components/people/FacultyDocumentsPanel.tsx`
**Done:**
- Form: 4 tabs now — Profile / Employment / Bio & Office / Research IDs.
- Detail: 5 tabs — Profile / Employment / Bio & Office / Research IDs / Documents.
- `FacultyDocumentsPanel` is the proof-of-pattern: one card per `DOC_TYPES` row, only PhD certificate shipped in v1.
- Documents tab badge shows uploaded-document count.

### B1.7: Phase B2 plan — add the remaining 11 doc categories
**Status:** Ready
**Notes:** Mechanical extension of `DOC_TYPES` in `FacultyDocumentsPanel.tsx`. Each new row inherits the upload flow without backend changes. Suggested ordering (high-NAAC-value first):
- `pan_card`, `aadhaar_card` (identity)
- `tenth_certificate`, `twelfth_certificate`, `ug_certificate`, `pg_certificate` (education, 1:1)
- `net_certificate`, `set_certificate`, `gate_scorecard` (certification, 1:1)
- `experience_certificate` (experience, 1:N — add multi-row affordance)
- `joining_letter`, `appointment_order` (current_employment, 1:1)
- `fdp_certificate`, `refresher_course_certificate` (training, 1:N)
- `award_letter` (award, 1:N)
- `membership_certificate` (membership, 1:N)
- `administrative_order` (administrative, 1:N)
- Bank/PF/ESI proofs (hr_payroll, 1:1)
- Conflict-of-interest, anti-ragging undertakings (self_declaration, 1:1, annual)

---

## Phase B2 — Full 12-category credential catalog (SHIPPED)

24 doc types across the 12 NAAC categories now live in
`DOC_TYPES` inside `FacultyDocumentsPanel.tsx`. The backend was
unchanged — `documentType` is open string at the model layer and
the routes already accept any value within the 12-category enum.

### B2.1: 24-row DOC_TYPES table (DONE)
**Files:** `admin-portal/src/components/people/FacultyDocumentsPanel.tsx`
**Done:** complete list per B1.7 — identity (3), education (5), certification (3), experience (1, 1:N), current_employment (2), training (2, 1:N), award (1, 1:N), membership (1, 1:N), administrative (1, 1:N), hr_payroll (3), self_declaration (2). PhD certificate kept inside the education group.

### B2.2: 1:1 vs 1:N card semantics (DONE)
**Done:** 1:N cards (experience, training, awards, memberships, administrative) carry a "multi" pill on the header. Card body shows every non-archived doc as a row + an "+ Add another" affordance. 1:1 cards show the latest doc only and chain `upload + archive(old)` in the frontend so "Replace" is one-click for the operator. Archive-on-replace is best-effort — if archival fails the UI shows both docs with individual Archive buttons.

### B2.3: Category accordion layout (DONE)
**Done:** Each category is a collapsible `<section>`. Default-expanded: the first two categories + any category that has at least one uploaded doc (auto-expand-on-data via `queueMicrotask`). Header shows category name + populated count badge + (N uploaded · M types). Inside the category, cards lay out in a 2-column grid on `md+`.

### B2.4: Compact card visuals (DONE)
**Done:** Light cards (one row of border, no shadow) so 24 cards across 12 categories fit reasonably in the viewport with all expanded. Status badges are 10px monospace pills, action icons are 12px.

---

## Phase B3 — Verification workflow (next session)

### B3.1: Approve / reject endpoints
**Status:** Pending
**Notes:** Two new routes — `POST /faculty/:facultyId/documents/:docId/approve` and `.../reject` (with reason). Service writes `verificationStatus`, `verifiedAt`, `verifiedBy` (from `req.user.id`). Audit log a `verify` event. RBAC: `people.update` minimum, but consider a finer-grained `faculty_documents.verify` permission.

### B3.2: Admin verification queue page
**Status:** Pending
**Notes:** New page at `/people/faculty/verification-queue`. Lists all docs with `verificationStatus = 'pending'` across all faculty, college-scoped. Each row: faculty name, doc title, category, uploaded date, View / Approve / Reject buttons.

### B3.3: Doc-row inline approve/reject in the panel
**Status:** Pending
**Notes:** On `FacultyDocumentsPanel`, when the caller has the verify permission, show inline Approve / Reject actions on each pending row.

### B3.4: Audit log surface on the doc detail
**Status:** Pending
**Notes:** Modal showing "uploaded by X on date, approved by Y on date, notes: ..." — pulls from M11 audit log.

---

## Phase C — External participation + verification

### C.1: Base `ExternalParticipation` schema with `verificationStatus`
### C.2: 6 sub-collection models extending the base
### C.3: Admin-approval endpoint
### C.4: UI: needs-verification badge + approval modal

---

## Phase D — Internal participation (lower priority)

### D.1–D.N: Teaching loads, exam duties, in-house experience, awards, … (~20 sub-collections)

---

## Phase E — NAAC report + AI verification agent (v2)

### E.1: NAAC evidence report (M10)
### E.2: `AG-FACULTY-VERIFY` Juvi sub-agent
