# Bulk Import Infrastructure (Strategic Gap 2)

**Source:** `Juvion_vs_CampX_Strategic_Comparison.pdf` §4.2 — "PARITY REQUIRED before pilot. This is the day-1 onboarding battleground."

## Why this matters

Every Indian college pilot starts with the same conversation: *"we have 8 years of student / faculty / fee data in Excel / Tally / a legacy ERP. How do we get it into your system?"* If the answer is "Finance will custom-script a migration per pilot", **every sale becomes a six-week services project** — exactly what the architectural-edge pitch was supposed to avoid.

CampX's data-imports system supports **40 entity types** with per-type schemas describing column requirements (INSERT vs UPDATE), cascading filters where one column's value depends on another, conditional visibility where some columns only appear under certain configurations, parent→child flow markers for group institutions, and a DataImport entity with status workflow.

Juvion currently has zero of this. Without it, the architectural-edge pitch (push vs pull, AI-native, ERP+Juvi) doesn't even get a chance to land — the institution disqualifies us on commodity onboarding.

## What we're building

A schema-driven bulk-import surface under M12 Platform & Infrastructure (`BULKIMP` sub-domain), structured so adding entity types is a **registry change**, not a new feature build per type.

## Acceptance criteria (Phase A — this session)

1. Operator uploads a CSV via a UI under `/platform/bulk-imports`.
2. System parses + validates rows against a per-entity schema and returns a preview with success / error counts.
3. Operator reviews the preview and commits.
4. System creates the target rows; failures are recorded per-row with explicit error messages; the operator sees both counts and a sample of failures.
5. The operator can revisit a past job to see what happened.
6. v1 ships **Students** as the only wired entity type — every other entity type adds via a single registry entry.
7. Multi-tenant: every job carries `collegeId`; the uploaded file lives at `colleges/<cid>/bulk-imports/<jobId>/<filename>`; commits write rows with the caller's `collegeId`.
8. No background workers in v1 — upload + parse + validate happens in the same request, commit in another. For 5–10k rows this is acceptable; chunked / queued processing is Phase B.

## Non-functional criteria

- **No new npm deps** for v1. Inline CSV parser (RFC-4180-ish, handles quoted fields with embedded commas + escaped quotes). XLSX support deferred to v1.5.
- **One canonical schema per entity type.** No v1/v2 schema coexistence — same anti-pattern lesson as the quota-enum cleanup.
- **Single import-job entity** for every entity type — generic state machine, generic UI, generic audit. Adding entity types is a registry entry, not new code paths.
- **Soft delete on jobs** via `archivedAt`. Job history is admin-facing for support / debug.

## Phased breakdown

### Phase A — Foundation (this session)

Lays the pattern. Wires Students end-to-end as the single live entity type.

- **`ImportJob` model.** lifecycle: `pending` → `parsing` → `preview_ready` → `committing` → `completed` / `failed` / `partial`. Tracks: caller, entityType, file S3 key, schema snapshot, mapping, totals, per-row results, error summary, timestamps.
- **Schema registry.** A TypeScript module that maps `entityType` → `ImportSchemaDefinition`. Each definition declares: fields (key, label, type, required, default, validator), unique-key columns (for upsert), and a `commitOne(row, ctx)` function that knows how to write to the target collection.
- **Service:** parseCsv, validateRows, createJob, getJob, listJobs, commitJob.
- **Controller + routes:**
  - `GET    /api/platform/bulk-imports/entity-types` — list supported entity types + schemas
  - `POST   /api/platform/bulk-imports` — multipart upload, returns the created job in `preview_ready` state
  - `GET    /api/platform/bulk-imports` — list recent jobs
  - `GET    /api/platform/bulk-imports/:id` — single job
  - `POST   /api/platform/bulk-imports/:id/commit` — commit pending preview
  - `DELETE /api/platform/bulk-imports/:id` — soft-archive
- **Frontend:** `/platform/bulk-imports` page with entity-type picker, upload drop-zone, preview table (first 50 rows + error rows highlighted), commit button, recent-jobs list.

### Phase B — Coverage

Add the next pre-launch entity types to the registry. The doc names: Admissions (applicants), Faculty, Staff, Subjects, Sections, Fee Structures, Fee Transactions. The implementation is **purely registry entries** — no new model / service / UI work.

### Phase C — Polish

- Cascading filters (column B options depend on column A value).
- Conditional visibility (only show columns relevant to the chosen operation mode).
- Parent→child flow markers for group institutions (one CSV row drives multi-row writes across linked colleges).
- XLSX support (add `exceljs` or `xlsx` dep).
- Background-worker processing for very large files (>10k rows).

### Phase D — Differentiator (v2)

**AI mapping agent.** Operator uploads a raw Excel from their existing system. The agent reads the headers + a few sample rows and proposes a `column-name → schema-field` mapping. Operator reviews and confirms. This is what CampX explicitly cannot do — they require the institution to pre-format their data to match the import schema.

## Out of scope for this session

- More than one wired entity type (Students only).
- XLSX uploads.
- AI mapping (Phase D).
- Background workers / chunked processing.
- Cascading filters / conditional visibility (Phase C).
- Update-mode (only insert in v1).
