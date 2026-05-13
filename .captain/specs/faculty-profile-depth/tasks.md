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
**Status:** Pending
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
