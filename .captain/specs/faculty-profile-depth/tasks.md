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

## Phase B — Research outputs (SHIPPED)

### B.1: `FacultyPublication` model with NAAC fields (DONE)
**Files:** `backend/src/models/people/FacultyPublication.ts`
**Done:** Fields exactly per the spec — title, authors (string), authorPosition (free-text to support "first" / "corresponding" / "3 of 5"), type (journal/conference/book_chapter/symposium), journal, publisher, year, volume, issue, pages, doi, publicationDate, indexingService (scopus/wos/ugc_care/other_indexed/none), quartile (Q1-Q4), impactPercentile (0-100), level (international/national/regional), sdgMapping (string[] using UN codes sdg_1..sdg_17), citationCount, notes, archivedAt. Indexes on (collegeId, facultyId, archivedAt) for the panel and (collegeId, indexingService, year DESC) for NAAC-window reports.

### B.2: `FacultyPatent` model + CRUD (DONE)
**Files:** `backend/src/models/people/FacultyPatent.ts`
**Done:** Fields: title, inventors (string), inventorRole (sole_inventor/first_inventor/co_inventor), jurisdiction (free-text), applicationNumber, patentNumber, ipcClassification, filingDate, publicationDate, grantDate, status (filed/published/granted/abandoned/expired), assignee (defaults to institution), abstract, notes, archivedAt. Indexes on (collegeId, facultyId, archivedAt) and (collegeId, status, jurisdiction).

### B.3: `FacultyProject` model + CRUD (DONE)
**Files:** `backend/src/models/people/FacultyProject.ts`
**Done:** Fields: title, fundingAgency, agencyType (government_national/government_state/industry/international/non_government/internal — NAAC discriminator), investigatorRole (pi/co_pi/investigator), coInvestigators (string), sanctionAmount (INR), sanctionOrderNumber, sanctionOrderUrl, sanctionDate, startDate, endDate, durationMonths, status (proposed/ongoing/completed/terminated), abstract, outcomes, notes, archivedAt.

### B.4: Service + controller + routes (DONE)
**Files:** `backend/src/modules/people/faculty-teaching-service.ts`, `faculty-teaching-controller.ts`, `routes.ts`
**Done:** Extended the existing Phase D1 `makeCrud` factory with three new CRUD bundles (`publications`, `patents`, `projects`) and three new handler sets. 15 new routes under `/api/people/faculty/:facultyId/{publications,patents,projects}{,/:id}` — standard list/create/get/patch/archive 5-tuple per entity. All gated by `authorize('people', <action>)`.

### B.5: Frontend panel (DONE)
**Files:** `admin-portal/src/services/faculty-teaching.ts`, `admin-portal/src/components/people/FacultyResearchOutputsPanel.tsx`
**Done:**
- Service client extended with 3 entity types + 4 functions per (list/create/update/archive).
- New `<FacultyResearchOutputsPanel />` renders three stacked sections (Publications, Patents, Sponsored projects). Each section: list table with NAAC-relevant columns + Add button + Edit / Archive actions per row.
- Publication table shows: title + journal + DOI link, year, indexing pill (color-coded per service), quartile pill (color-coded Q1 emerald → Q4 slate), level, author position.
- Patent table shows: title + inventor role, app # / patent #, jurisdiction, filing date, status pill.
- Project table shows: title + funding agency, agency type, role, sanction amount (INR formatted with Intl.NumberFormat), period, status. Includes a "Total sanctioned" footer summing across rows.
- Modals are heavier than Phase D1: Publication modal has a dedicated "NAAC scoring fields" sub-card with indexing + quartile + percentile + level + SDG multi-select chip-grid (17 SDG options). Patent modal includes IPC classification + 3 separate date fields. Project modal includes 6 agency types + sanction order link + outcomes.

### B.6: Detail-page wiring (DONE)
**Files:** `admin-portal/src/pages/people/FacultyDetailPage.tsx`
**Done:**
- 7th tab "Research Outputs" between "Teaching" and "Documents".
- Renamed existing "Teaching & Research" tab to just "Teaching" since the new tab is where the research outputs actually live.
- Combined badge sums publications + patents + projects counts.

Backend smoke test:
  POST /faculty/<id>/publications with quartile=Q1, indexingService=scopus, impactPercentile=92, sdgMapping=['sdg_4','sdg_9'] → 201 with full payload persisted; GET round-trips all NAAC scoring fields.

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

## Phase B3 — Verification workflow (SHIPPED)

### B3.1: Approve / reject endpoints + listPending (DONE)
**Files:** `backend/src/modules/people/faculty-document-service.ts`, `faculty-document-controller.ts`, `routes.ts`
**Done:**
- `approveFacultyDocument(...)` — flips status to `approved`, stamps `verifiedAt` + `verifiedBy` (when caller ID is a real ObjectId), idempotent on already-approved, refuses to re-approve a `rejected` doc.
- `rejectFacultyDocument(...)` — flips to `rejected`, REQUIRES `reason` (stored in `verificationNotes`).
- `listPendingFacultyDocuments(collegeId)` — admin queue, oldest-first, populates `facultyId.personId.name` for the queue UI.
- Audit log: reuses generic `approve` / `reject` actions with `entityType: 'FacultyDocument'` as the discriminator. Adds entries like "Admin approved <doc title>".
- Routes (all `authorize('people', 'update')` or `'read'`):
    - `GET    /api/people/faculty-document-queue` — non-parameterised path so it never collides with `/faculty/:facultyId/documents/:docId`.
    - `POST   /api/people/faculty/:facultyId/documents/:docId/approve`
    - `POST   /api/people/faculty/:facultyId/documents/:docId/reject`

### B3.2: Admin verification queue page (DONE)
**Files:** `admin-portal/src/pages/people/FacultyDocumentQueuePage.tsx`
**Done:** Lives at `/people/faculty/document-queue`. Lists every pending doc college-wide, oldest first. Category-filter chips show queue depth per category. Empty state celebrates with a green "All caught up" panel. Each row carries inline View / Approve / Reject (Reject opens a prompt for the reason).

### B3.3: Inline approve/reject on per-faculty panel (DONE)
**Files:** `admin-portal/src/components/people/FacultyDocumentsPanel.tsx`
**Done:** When a doc's `verificationStatus === 'pending'`, the row gets ✓ (approve) and ✗ (reject) buttons next to View / Archive. Reject uses `window.prompt` to capture the reason and surfaces inline errors. Auto-invalidates the per-faculty doc query on success.

### B3.4: Cross-link from panel to queue (DONE)
**Files:** `admin-portal/src/components/people/FacultyDocumentsPanel.tsx`
**Done:** The info banner at the top of the Documents tab now carries a "Verification queue →" button so admins discover the college-wide queue without hunting for it in the nav.

### B3.5: Routing (DONE)
**Files:** `admin-portal/src/pages/People.tsx`
**Done:** Added `<Route path="faculty/document-queue" ... />` BEFORE the `faculty/:id` route so the static path never gets eaten by the `:id` matcher.

---

## Phase B4 — Audit-log surface (SHIPPED minus RBAC)

### B4.1: Audit-history modal on each doc row (DONE)
**Files:** `backend/src/modules/people/faculty-document-service.ts`, `faculty-document-controller.ts`, `routes.ts`, `admin-portal/src/components/people/FacultyDocumentAuditModal.tsx`, `FacultyDocumentsPanel.tsx`
**Done:**
- New endpoint `GET /api/people/faculty/:facultyId/documents/:docId/audit` returns every AuditLog row for `entityType: 'FacultyDocument' + entityId: docId`, newest first. Multi-tenant scoped — `loadFacultyScoped` runs first.
- New `<FacultyDocumentAuditModal />` renders a vertical timeline with action pills (Uploaded / Metadata edited / Approved / Rejected / Archived), timestamps, performedBy, and any field changes from `changes[]`.
- Each doc row in `FacultyDocumentsPanel` gains a 🕓 History icon button that opens the modal scoped to that doc.

### B4.2: Verification SLA badges (DONE)
**Files:** `admin-portal/src/pages/people/FacultyDocumentQueuePage.tsx`
**Done:** Helpers `daysPending(createdAt)` + `slaBadgeFor(days)` compute amber (>7d) and red (>30d) badges. Fresh items (<7d) render no badge so the queue stays scannable. Badge appears under the upload date column.

### B4.3: Long-pending filter chips (DONE)
**Done:** Two new filter chips alongside the category filter — "7d+ pending (N)" amber and "Overdue 30d+ (N)" red. SLA filter is orthogonal to category filter; both compose.

### B4.4: Bulk approve / reject (DONE)
**Files:** `backend/src/modules/people/faculty-document-service.ts`, `faculty-document-controller.ts`, `routes.ts`, `admin-portal/src/services/faculty-documents.ts`, `FacultyDocumentQueuePage.tsx`
**Done:**
- Backend: `bulkApproveFacultyDocuments(collegeId, docIds, performedBy, notes?)` and `bulkRejectFacultyDocuments(collegeId, docIds, performedBy, reason)` iterate ids and dispatch the per-doc service so the audit trail stays row-grained. Result shape: `{ approved/rejected: N, failures: [{ docId, error }] }` — failures don't abort the batch.
- Routes: `POST /api/people/faculty-documents/bulk-approve` and `.../bulk-reject` (non-parameterised so they never collide with `/faculty/:facultyId/documents/:docId`).
- UI: master checkbox in column 0, per-row checkboxes, toolbar appears when selection is non-empty showing "Approve N / Reject N / Clear". Reject prompts once for a shared reason that's applied verbatim to every doc. Selection auto-clears after a successful bulk call.
- Filter-aware: hidden-by-filter selected ids are tracked separately so a stale id can't sneak into a bulk action — the toolbar shows "N selected (M hidden by filter)" when relevant.

### B4.5: Finer-grained RBAC (DEFERRED)
**Status:** Pending — risky for a single session.
**Notes:** Today every `people.update` holder can approve. Adding a discrete `faculty_documents.verify` permission would let HoDs approve their own department's docs without granting them full faculty-edit rights. Requires changes across the auth middleware, the permission registry, and every callsite that gates faculty document mutations. Best handled as a focused RBAC PR.

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

## Phase D1 — Teaching & Research sub-collections (SHIPPED)

Three Phase-D sub-collections wired end-to-end. These cover the
NAAC-criteria gaps that the document store doesn't reach: faculty
workload (2.2 / 2.6), research guidance (3.4.2), and authored
works (3.3).

### D1.1: Three models (DONE)
**Files:** `backend/src/models/people/FacultySubjectAssignment.ts`, `FacultyResearchScholar.ts`, `FacultyBook.ts`
**Done:**
- `FacultySubjectAssignment` — subjectCode, subjectName, optional subjectId ref, academicYear, semester, role (instructor/co-instructor/lab-incharge/tutorial), weeklyHours, studentCount, status (planned/active/completed). Indexed on (collegeId, facultyId, archivedAt) for the panel and (collegeId, academicYear, semester) for future workload analytics.
- `FacultyResearchScholar` — scholarName, scholarType (phd/mtech/mphil/undergrad_project), topic, registrationYear, completionYear, status (ongoing/completed/discontinued/awarded), coGuide, university, thesisLink (Shodhganga). NAAC 3.4.2 directly counts off `status: 'awarded'`.
- `FacultyBook` — title, role (author/co_author/editor/co_editor/translator), bookType (textbook/monograph/edited_volume/chapter), publisher, ISBN, year, edition, pages, level (international/national/regional), coAuthors, DOI. The `level` field is what NAAC 3.3 specifically asks for.

All three carry `archivedAt` for soft delete (matches the FacultyDocument pattern).

### D1.2: Combined service (DONE)
**Files:** `backend/src/modules/people/faculty-teaching-service.ts`
**Done:** Single file with `makeCrud<TDoc extends Document>()` factory producing identical list / getOne / create / update / archive shape for all three entities. Each operation runs `loadFacultyScoped` first so a leaked facultyId can't cross tenants. Three named exports — `subjectAssignments`, `researchScholars`, `books` — each a CRUD bundle for the respective collection. No verification workflow needed (these are institution-self-certified).

### D1.3: Combined controller (DONE)
**Files:** `backend/src/modules/people/faculty-teaching-controller.ts`
**Done:** `makeHandlers(bundle)` produces an Express handler set for any CRUD bundle. Three named exports: `subjectHandlers`, `scholarHandlers`, `bookHandlers`. Type signature `CrudBundle` uses `Promise<unknown>` on read paths so the union works across all three entity types.

### D1.4: 15 routes (DONE)
**Files:** `backend/src/modules/people/routes.ts`
**Done:** Standard CRUD 5-tuple × 3 entities under `/api/people/faculty/:facultyId/{subjects,scholars,books}{,/:id}`. All gated by `authorize('people', <action>)`.

### D1.5: Frontend service + panel (DONE)
**Files:** `admin-portal/src/services/faculty-teaching.ts`, `admin-portal/src/components/people/FacultyTeachingPanel.tsx`
**Done:**
- `faculty-teaching.ts` service with strict types per entity (FacultySubjectAssignmentDoc, FacultyResearchScholarDoc, FacultyBookDoc).
- `FacultyTeachingPanel` renders three stacked sections (Subjects taught, Research scholars guided, Books authored / edited). Each section: list table with NAAC-relevant columns + "Add" button + Edit / Archive actions per row. Modal forms per entity capture the full schema.
- Status pills are color-coded (emerald for active/awarded, blue for planned/ongoing, slate for completed, red for discontinued).
- React Query keys are per-entity per-faculty so panels refresh independently.

### D1.6: Detail-page wiring (DONE)
**Files:** `admin-portal/src/pages/people/FacultyDetailPage.tsx`
**Done:**
- New tab "Teaching & Research" between "Research IDs" and "Documents".
- Combined badge: sum of subjects + scholars + books counts. So operators see "is anything tracked for this faculty?" at a glance even from another tab.
- The Faculty detail page now has six tabs total — long but each carries distinct value.

Backend smoke test: `POST /faculty/:fid/subjects` with `{ subjectCode: 'CS302', subjectName: 'Operating Systems', academicYear: '2025-26', semester: 5, role: 'instructor', weeklyHours: 4, studentCount: 62, status: 'active' }` → 201 with persisted row; `GET` round-trips.

### D1.7: What still belongs in Phase D
**Status:** Pending (lower priority)
**Notes:** The original Phase D scope mentioned ~20 sub-collections covering teaching loads, examination duties, work experience, awards, etc. The three shipped here are the highest-NAAC-leverage ones. Future Phase D items as separate sub-phases:
- D2: Examination duties (NAAC 2.5.2) — invigilation, paper-setting, valuation roles per AY
- D3: Awards & recognitions (in-house). Note: external awards already covered by Phase B2 `award_letter` document type — D3 is for NON-document-backed recognitions.
- D4: External committee memberships (BoS, BoG, expert panels) at other institutions
- D5: Consultancy work (NAAC 3.2.1) — clients, value, period, project description
- D6: Sponsored research projects (NAAC 3.1 / 3.2). Note: separate from Phase B sub-collections (Publications / Patents / Projects) which carry the NAAC research-output fields.

---

## Phase E — NAAC report + AI verification agent (v2)

### E.1: NAAC evidence report (M10)
### E.2: `AG-FACULTY-VERIFY` Juvi sub-agent
