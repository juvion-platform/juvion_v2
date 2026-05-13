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

## Phase E — NAAC report + AI verification agent (v2)

### E.1: NAAC evidence report (M10)
### E.2: `AG-FACULTY-VERIFY` Juvi sub-agent
