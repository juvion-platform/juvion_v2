# Student Bulk Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CSV bulk import of students — with a template whose mandatory columns are marked `*` — reachable from the Students list page by anyone who can create students.

**Architecture:** Reuse the existing schema-driven import engine (`bulk-import-service` + `bulk-import-registry`). The `student` registry entry grows from 11 to 25 fields and moves to its own file. A thin `people`-gated façade under `/api/people/students/import/*` delegates to the same service, because only `admin`/`principal` hold `platform:create` and Registrars would otherwise get a 403.

**Tech Stack:** Express 4, Mongoose 8, Zod 3, multer (already configured), React 19, React Query 5, Vitest, Playwright.

Spec: `docs/superpowers/specs/2026-07-27-student-bulk-import-design.md`

## Global Constraints

- **Multi-tenancy:** every model has `collegeId`; every query filters by it. Never query without it.
- **AppError signature:** `new AppError(statusCode, message)` — status code FIRST.
- **Service layer:** CRUD functions take `collegeId` as the first param; CUD functions take `performedBy` last and call `createAuditLog()`.
- **ObjectId → string:** use `String(doc._id)`, not `doc._id as string`.
- **TypeScript:** `strict`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`. Prefix unused params with `_`.
- **No Mongo transactions.** The in-memory test harness is not a replica set. Follow the compensating-rollback precedent documented in `backend/src/modules/finance/programme-transfer-service.ts:12-23`.
- **Existing limits (do not change):** `IMPORT_FILE_MAX_BYTES = 10 MB`, `IMPORT_MAX_ROWS = 10_000`, `PREVIEW_SUCCESS_LIMIT = 50`.
- **Verify with:** `npm run typecheck` (all 3 workspaces), `npx vitest run --root backend`, `npx vitest run --root backend --config vitest.e2e.config.ts`.
- **Backend unit tests** live in `src/**/__tests__/*.test.ts`; **backend e2e** in `src/__e2e__/**/*.test.ts` (separate config).

---

### Task 1: Header normalization in the shared parser

Templates emit `name*`. The parser maps headers by exact `fieldKey`
(`bulk-import-service.ts:355`), so without this every required column reads as
empty and every row fails. Bare `fieldKey` headers must keep working.

**Files:**
- Modify: `backend/src/modules/platform/bulk-import-service.ts` (add export; use it at the header-mapping loop ~line 346)
- Test: `backend/src/modules/platform/__tests__/bulk-import-header-normalize.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `export function normalizeImportHeader(header: string): string`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/platform/__tests__/bulk-import-header-normalize.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeImportHeader, parseCsv } from '../bulk-import-service';

describe('normalizeImportHeader', () => {
  it('strips a trailing asterisk', () => {
    expect(normalizeImportHeader('name*')).toBe('name');
  });

  it('strips surrounding whitespace', () => {
    expect(normalizeImportHeader('  phone  ')).toBe('phone');
  });

  it('strips whitespace around the asterisk', () => {
    expect(normalizeImportHeader('  programmeCode * ')).toBe('programmeCode');
  });

  it('leaves a bare fieldKey untouched — pre-existing files must still import', () => {
    expect(normalizeImportHeader('admissionYear')).toBe('admissionYear');
  });

  it('strips only ONE trailing asterisk, so a key legitimately ending in * is not over-eaten', () => {
    expect(normalizeImportHeader('weird**')).toBe('weird*');
  });

  it('does not touch a mid-string asterisk', () => {
    expect(normalizeImportHeader('a*b')).toBe('a*b');
  });

  it('handles an empty header cell', () => {
    expect(normalizeImportHeader('')).toBe('');
  });
});

describe('parseCsv + normalization round-trip', () => {
  it('a template-shaped CSV maps onto bare field keys', () => {
    const csv = 'name*,phone*,email\nAarav,9876543210,a@b.c';
    const { headers, rows } = parseCsv(csv);
    const mapped: Record<string, string> = {};
    headers.forEach((h, i) => { mapped[normalizeImportHeader(h)] = rows[0]![i] ?? ''; });
    expect(mapped.name).toBe('Aarav');
    expect(mapped.phone).toBe('9876543210');
    expect(mapped.email).toBe('a@b.c');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --root backend src/modules/platform/__tests__/bulk-import-header-normalize.test.ts`
Expected: FAIL — `normalizeImportHeader is not a function` / no export named `normalizeImportHeader`.

- [ ] **Step 3: Add the function**

In `backend/src/modules/platform/bulk-import-service.ts`, directly above `parseCsv`:

```typescript
/**
 * Normalize a CSV header cell to a schema `fieldKey`.
 *
 * Downloadable templates mark mandatory columns with a trailing `*`
 * (`name*`). The row mapper matches headers to `fieldKey` by exact string,
 * so without this a file downloaded from our own template would report every
 * required field as empty and fail every row.
 *
 * Strips surrounding whitespace and at most ONE trailing asterisk, so a
 * bare `fieldKey` — every CSV exported before templates gained the marker —
 * passes through unchanged.
 */
export function normalizeImportHeader(header: string): string {
  return header.trim().replace(/\s*\*$/, '').trim();
}
```

- [ ] **Step 4: Use it in the row mapper**

In `uploadAndValidate`, replace the header-mapping loop (currently at ~line 346):

```typescript
    parsed.headers.forEach((h, j) => {
      rawObj[h] = cells[j] ?? '';
    });
```

with:

```typescript
    parsed.headers.forEach((h, j) => {
      // Template headers carry a `*` on mandatory columns; map back to fieldKey.
      rawObj[normalizeImportHeader(h)] = cells[j] ?? '';
    });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run --root backend src/modules/platform/__tests__/bulk-import-header-normalize.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 6: Verify no existing import test regressed**

Run: `npx vitest run --root backend src/modules/platform`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/platform/bulk-import-service.ts \
        backend/src/modules/platform/__tests__/bulk-import-header-normalize.test.ts
git commit -m "feat(bulk-import): normalize asterisk-marked template headers

Templates will mark mandatory columns as name*. The row mapper matches
headers to fieldKey by exact string, so without normalization a file
downloaded from our own template fails every required field as empty.
Strips one trailing asterisk and surrounding whitespace; bare fieldKey
headers are unchanged, so files exported before this still import."
```

---

### Task 2: Student reference resolution

Codes → ObjectIds, scoped to the college. Pure lookup, no writes. Split from
the registry so the 795-line `bulk-import-registry.ts` does not absorb another
250 lines of student-specific logic.

**Files:**
- Create: `backend/src/modules/people/student-import-refs.ts`
- Test: `backend/src/modules/people/__tests__/student-import-refs.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export interface ResolvedRefs { programmeId: string; programmeName: string; branchId?: string; branchName?: string; batchId?: string; regulationId?: string; }`
  - `export async function resolveStudentRefs(collegeId: string, row: Record<string, unknown>): Promise<{ ok: true; value: ResolvedRefs } | { ok: false; error: string }>`
  - `export async function validateCatalogCodes(collegeId: string, row: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }>`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/people/__tests__/student-import-refs.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import { Programme } from '../../../models/academic-structure/Programme';
import { Branch } from '../../../models/academic-structure/Branch';
import { Batch } from '../../../models/academic-structure/Batch';
import { Regulation } from '../../../models/academic-structure/Regulation';
import { FeeQuota } from '../../../models/finance/FeeQuota';
import { FeeCategory } from '../../../models/finance/FeeCategory';
import { resolveStudentRefs, validateCatalogCodes } from '../student-import-refs';

const oid = () => new mongoose.Types.ObjectId();
let collegeId: string;
let programmeId: mongoose.Types.ObjectId;
let regulationId: mongoose.Types.ObjectId;

beforeAll(async () => { await setupMongo(); }, 60_000);
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); });

async function seed() {
  collegeId = String(oid());
  regulationId = oid();
  programmeId = oid();
  await Regulation.create({ _id: regulationId, collegeId, code: 'R20', name: 'R20', effectiveFromYear: 2020 });
  await Programme.create({ _id: programmeId, collegeId, code: 'BTCSE', name: 'BTech CSE', level: 'UG', durationYears: 4, regulationId });
  await Branch.create({ collegeId, code: 'CSE', name: 'Computer Science', programmeId, departmentId: oid() });
  await Batch.create({ collegeId, code: 'B2025', name: '2025 Batch', admissionYear: 2025, programmeId, regulationId });
  await FeeQuota.create({ collegeId, code: 'convener', name: 'Convener', status: 'active' });
  await FeeCategory.create({ collegeId, code: 'OC', name: 'OC', status: 'active' });
}

describe('resolveStudentRefs', () => {
  it('resolves every supplied code to an id', async () => {
    await seed();
    const res = await resolveStudentRefs(collegeId, {
      programmeCode: 'BTCSE', branchCode: 'CSE', batchCode: 'B2025', regulationCode: 'R20',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.programmeId).toBe(String(programmeId));
      expect(res.value.branchId).toBeDefined();
      expect(res.value.batchId).toBeDefined();
      expect(res.value.regulationId).toBe(String(regulationId));
      // Names are carried so preview can echo the resolution back to the operator.
      expect(res.value.programmeName).toBe('BTech CSE');
      expect(res.value.branchName).toBe('Computer Science');
    }
  });

  it('names the offending code when a programme is unknown', async () => {
    await seed();
    const res = await resolveStudentRefs(collegeId, { programmeCode: 'NOPE' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('unknown programme code "NOPE"');
  });

  it('rejects a code that exists in another college', async () => {
    await seed();
    const other = String(oid());
    const res = await resolveStudentRefs(other, { programmeCode: 'BTCSE' });
    expect(res.ok).toBe(false);
  });

  it('leaves optional refs undefined when their column is blank', async () => {
    await seed();
    const res = await resolveStudentRefs(collegeId, { programmeCode: 'BTCSE' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.branchId).toBeUndefined();
      expect(res.value.batchId).toBeUndefined();
    }
  });
});

describe('validateCatalogCodes', () => {
  it('accepts active quota and category codes', async () => {
    await seed();
    expect((await validateCatalogCodes(collegeId, { quota: 'convener', category: 'OC' })).ok).toBe(true);
  });

  it('rejects an unknown quota with a specific message', async () => {
    await seed();
    const res = await validateCatalogCodes(collegeId, { quota: 'bogus' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('unknown quota code "bogus"');
  });

  it('passes when both columns are blank', async () => {
    await seed();
    expect((await validateCatalogCodes(collegeId, {})).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --root backend src/modules/people/__tests__/student-import-refs.test.ts`
Expected: FAIL — cannot find module `../student-import-refs`.

> If `FeeQuota` / `FeeCategory` are not at those paths, run
> `grep -rl "FeeQuota\b" backend/src/models` and fix the import path in the
> test before continuing. Do not change the assertions.

- [ ] **Step 3: Write the implementation**

Create `backend/src/modules/people/student-import-refs.ts`:

```typescript
/**
 * Reference resolution for the student bulk import.
 *
 * Operators fill a spreadsheet with human-readable codes, not ObjectIds.
 * This turns those codes into ids, scoped to the calling college.
 *
 * Nothing here creates records: an unmatched programme/branch/batch/
 * regulation/quota/category code is a typo, not intake data, so the row
 * fails with a message naming the offending value. Parents are the one
 * exception and are handled in student-import-service.ts.
 */
import { Programme } from '../../models/academic-structure/Programme';
import { Branch } from '../../models/academic-structure/Branch';
import { Batch } from '../../models/academic-structure/Batch';
import { Regulation } from '../../models/academic-structure/Regulation';
import { FeeQuota } from '../../models/finance/FeeQuota';
import { FeeCategory } from '../../models/finance/FeeCategory';

export interface ResolvedRefs {
  programmeId: string;
  /** Carried so preview can show what a code resolved to, not just that it did. */
  programmeName: string;
  branchId?: string;
  branchName?: string;
  batchId?: string;
  regulationId?: string;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function cell(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

export async function resolveStudentRefs(
  collegeId: string,
  row: Record<string, unknown>,
): Promise<Result<ResolvedRefs>> {
  const programmeCode = cell(row, 'programmeCode');
  if (!programmeCode) return { ok: false, error: 'programmeCode is required' };

  const programme = await Programme.findOne({ collegeId, code: programmeCode }).select('_id name').lean();
  if (!programme) return { ok: false, error: `unknown programme code "${programmeCode}"` };

  const out: ResolvedRefs = { programmeId: String(programme._id), programmeName: programme.name };

  const branchCode = cell(row, 'branchCode');
  if (branchCode) {
    const branch = await Branch.findOne({ collegeId, code: branchCode }).select('_id name').lean();
    if (!branch) return { ok: false, error: `unknown branch code "${branchCode}"` };
    out.branchId = String(branch._id);
    out.branchName = branch.name;
  }

  const batchCode = cell(row, 'batchCode');
  if (batchCode) {
    const batch = await Batch.findOne({ collegeId, code: batchCode }).select('_id').lean();
    if (!batch) return { ok: false, error: `unknown batch code "${batchCode}"` };
    out.batchId = String(batch._id);
  }

  const regulationCode = cell(row, 'regulationCode');
  if (regulationCode) {
    const regulation = await Regulation.findOne({ collegeId, code: regulationCode }).select('_id').lean();
    if (!regulation) return { ok: false, error: `unknown regulation code "${regulationCode}"` };
    out.regulationId = String(regulation._id);
  }

  return { ok: true, value: out };
}

/**
 * Quota and category are admin-managed catalogs with no model enum, and the
 * pre-existing importer accepted any string. Validating is a deliberate
 * behaviour change: an unrecognised quota silently produces a student that
 * never fee-pins, which is far harder to notice than a rejected row.
 */
export async function validateCatalogCodes(
  collegeId: string,
  row: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const quota = cell(row, 'quota');
  if (quota) {
    const found = await FeeQuota.findOne({ collegeId, code: quota, status: { $ne: 'inactive' } }).select('_id').lean();
    if (!found) return { ok: false, error: `unknown quota code "${quota}"` };
  }

  const category = cell(row, 'category');
  if (category) {
    const found = await FeeCategory.findOne({ collegeId, code: category, status: { $ne: 'inactive' } }).select('_id').lean();
    if (!found) return { ok: false, error: `unknown category code "${category}"` };
  }

  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --root backend src/modules/people/__tests__/student-import-refs.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/people/student-import-refs.ts \
        backend/src/modules/people/__tests__/student-import-refs.test.ts
git commit -m "feat(people): resolve student import codes to ids

Operators fill spreadsheets with codes, not ObjectIds. Resolves
programme/branch/batch/regulation within the college and validates
quota/category against the active catalogs. Unmatched values fail the row
naming the offending code rather than being created — an unknown code is a
typo, not intake data."
```

---

### Task 3: Upsert key lookup and Blocked classification

Decides Create / Update / Blocked for a row without writing anything, so
preview can label rows honestly.

**Files:**
- Create: `backend/src/modules/people/student-import-match.ts`
- Test: `backend/src/modules/people/__tests__/student-import-match.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export type ImportRowAction = 'create' | 'update' | 'blocked';`
  - `export interface MatchResult { action: ImportRowAction; studentId?: string; reason?: string; }`
  - `export async function matchExistingStudent(collegeId: string, row: Record<string, unknown>): Promise<MatchResult>`
  - `export const BLOCKED_STATUSES: readonly string[]`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/people/__tests__/student-import-match.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { matchExistingStudent } from '../student-import-match';

const oid = () => new mongoose.Types.ObjectId();
let collegeId: string;

beforeAll(async () => { await setupMongo(); }, 60_000);
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); });

async function makeStudent(overrides: Record<string, unknown> = {}) {
  const person = await Person.create({
    collegeId, name: 'Existing Student', phone: '9000000001', ...(overrides.person as object ?? {}),
  });
  delete (overrides as { person?: unknown }).person;
  return Student.create({
    collegeId, personId: person._id, admissionYear: 2025, status: 'active', ...overrides,
  });
}

beforeEach(() => { collegeId = String(oid()); });

describe('matchExistingStudent', () => {
  it('returns create when nothing matches', async () => {
    const res = await matchExistingStudent(collegeId, { rollNumber: 'R1', admissionYear: 2025, phone: '9000000009' });
    expect(res.action).toBe('create');
  });

  it('matches on rollNumber first', async () => {
    const s = await makeStudent({ rollNumber: 'R1' });
    const res = await matchExistingStudent(collegeId, { rollNumber: 'R1' });
    expect(res.action).toBe('update');
    expect(res.studentId).toBe(String(s._id));
  });

  it('falls back to aadhaar when there is no rollNumber', async () => {
    const person = await Person.create({ collegeId, name: 'A', phone: '9000000002', aadhaar: '234567890101' });
    const s = await Student.create({ collegeId, personId: person._id, admissionYear: 2025, status: 'active' });
    const res = await matchExistingStudent(collegeId, { aadhaar: '234567890101' });
    expect(res.action).toBe('update');
    expect(res.studentId).toBe(String(s._id));
  });

  it('falls back to phone + admissionYear last', async () => {
    const s = await makeStudent({});
    const res = await matchExistingStudent(collegeId, { phone: '9000000001', admissionYear: 2025 });
    expect(res.action).toBe('update');
    expect(res.studentId).toBe(String(s._id));
  });

  it('does not match the same phone in a different admission year', async () => {
    await makeStudent({});
    const res = await matchExistingStudent(collegeId, { phone: '9000000001', admissionYear: 2024 });
    expect(res.action).toBe('create');
  });

  it('never matches across colleges', async () => {
    await makeStudent({ rollNumber: 'R1' });
    const res = await matchExistingStudent(String(oid()), { rollNumber: 'R1' });
    expect(res.action).toBe('create');
  });

  it('blocks a sealed student', async () => {
    await makeStudent({ rollNumber: 'R1', isSealed: true });
    const res = await matchExistingStudent(collegeId, { rollNumber: 'R1' });
    expect(res.action).toBe('blocked');
    expect(res.reason).toMatch(/sealed/i);
  });

  it('blocks an exited student', async () => {
    await makeStudent({ rollNumber: 'R2', status: 'exited' });
    const res = await matchExistingStudent(collegeId, { rollNumber: 'R2' });
    expect(res.action).toBe('blocked');
  });

  it('blocks an alumni student', async () => {
    await makeStudent({ rollNumber: 'R3', status: 'alumni' });
    const res = await matchExistingStudent(collegeId, { rollNumber: 'R3' });
    expect(res.action).toBe('blocked');
  });
});
```

Add `beforeEach` to the vitest import at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --root backend src/modules/people/__tests__/student-import-match.test.ts`
Expected: FAIL — cannot find module `../student-import-match`.

- [ ] **Step 3: Write the implementation**

Create `backend/src/modules/people/student-import-match.ts`:

```typescript
/**
 * Natural-key matching for the student bulk import.
 *
 * The realistic workflow is "fix three rows, re-upload the whole file", so
 * import must be idempotent. Create-only semantics duplicate students with no
 * roll number and hard-fail those with one, against the unique sparse index on
 * (collegeId, rollNumber).
 *
 * Read-only: preview calls this to label rows before anything is written.
 */
import { Person } from '../../models/people/Person';
import { Student } from '../../models/people/Student';

export type ImportRowAction = 'create' | 'update' | 'blocked';

export interface MatchResult {
  action: ImportRowAction;
  studentId?: string;
  reason?: string;
}

/**
 * A spreadsheet must never rewrite a record the lifecycle has closed.
 * `isSealed` is checked separately since it is a flag, not a status.
 */
export const BLOCKED_STATUSES: readonly string[] = ['exited', 'alumni', 'graduated'];

function cell(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

export async function matchExistingStudent(
  collegeId: string,
  row: Record<string, unknown>,
): Promise<MatchResult> {
  const rollNumber = cell(row, 'rollNumber');
  const aadhaar = cell(row, 'aadhaar');
  const phone = cell(row, 'phone');
  const admissionYear = cell(row, 'admissionYear');

  let found: { _id: unknown; status?: string; isSealed?: boolean } | null = null;

  // 1. rollNumber — the college's own unique identifier.
  if (rollNumber) {
    found = await Student.findOne({ collegeId, rollNumber })
      .select('_id status isSealed').lean() as typeof found;
  }

  // 2. aadhaar — lives on Person, so resolve through it.
  if (!found && aadhaar) {
    const person = await Person.findOne({ collegeId, aadhaar }).select('_id').lean();
    if (person) {
      found = await Student.findOne({ collegeId, personId: person._id })
        .select('_id status isSealed').lean() as typeof found;
    }
  }

  // 3. phone + admissionYear — weakest key, so it is last and requires both.
  //    Phone alone would collide across siblings sharing a family number.
  if (!found && phone && admissionYear) {
    const person = await Person.findOne({ collegeId, phone }).select('_id').lean();
    if (person) {
      found = await Student.findOne({ collegeId, personId: person._id, admissionYear: Number(admissionYear) })
        .select('_id status isSealed').lean() as typeof found;
    }
  }

  if (!found) return { action: 'create' };

  if (found.isSealed) {
    return { action: 'blocked', studentId: String(found._id), reason: 'record is sealed' };
  }
  if (found.status && BLOCKED_STATUSES.includes(found.status)) {
    return { action: 'blocked', studentId: String(found._id), reason: `record is ${found.status}` };
  }

  return { action: 'update', studentId: String(found._id) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --root backend src/modules/people/__tests__/student-import-match.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/people/student-import-match.ts \
        backend/src/modules/people/__tests__/student-import-match.test.ts
git commit -m "feat(people): natural-key matching for student import

Matches rollNumber, then aadhaar, then phone+admissionYear, scoped to the
college, so re-uploading a corrected file is idempotent rather than
duplicating or colliding with the unique rollNumber index.

Sealed, exited, alumni and graduated records resolve to blocked and are
never written — a spreadsheet must not rewrite what the lifecycle closed."
```

---

### Task 4: Commit with parent linking and compensating rollback

The only path where this feature can corrupt data rather than reject input.

**Files:**
- Create: `backend/src/modules/people/student-import-service.ts`
- Test: `backend/src/modules/people/__tests__/student-import-service.test.ts`

**Interfaces:**
- Consumes:
  - `resolveStudentRefs`, `validateCatalogCodes` from `./student-import-refs`
  - `matchExistingStudent`, `type MatchResult` from `./student-import-match`
- Produces:
  - `export async function commitStudentRow(typedRow: Record<string, unknown>, ctx: { collegeId: string; performedBy: string }): Promise<{ id: string }>`
  - `export async function parentExistsByPhone(collegeId: string, phone: string): Promise<boolean>` — used by the preview hook in Task 6 to report guardians that *would* be created, without creating them.

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/people/__tests__/student-import-service.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { Parent } from '../../../models/people/Parent';
import { Programme } from '../../../models/academic-structure/Programme';
import { Regulation } from '../../../models/academic-structure/Regulation';
import { commitStudentRow } from '../student-import-service';

const oid = () => new mongoose.Types.ObjectId();
let collegeId: string;
const ctx = () => ({ collegeId, performedBy: 'tester' });

beforeAll(async () => { await setupMongo(); }, 60_000);
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); vi.restoreAllMocks(); });

beforeEach(async () => {
  collegeId = String(oid());
  const regulationId = oid();
  await Regulation.create({ _id: regulationId, collegeId, code: 'R20', name: 'R20', effectiveFromYear: 2020 });
  await Programme.create({ collegeId, code: 'BTCSE', name: 'BTech CSE', level: 'UG', durationYears: 4, regulationId });
});

const baseRow = () => ({
  name: 'Aarav Sharma', phone: '9876543210', programmeCode: 'BTCSE', admissionYear: 2025,
});

describe('commitStudentRow — create', () => {
  it('creates Person + Student and returns the student id', async () => {
    const { id } = await commitStudentRow(baseRow(), ctx());
    const student = await Student.findById(id);
    expect(student).not.toBeNull();
    expect(await Person.countDocuments({ collegeId })).toBe(1);
  });

  it('defaults status to active, not the model default of prospective', async () => {
    const { id } = await commitStudentRow(baseRow(), ctx());
    expect((await Student.findById(id))!.status).toBe('active');
  });

  it('fails the row when the programme code is unknown', async () => {
    await expect(
      commitStudentRow({ ...baseRow(), programmeCode: 'NOPE' }, ctx()),
    ).rejects.toThrow(/unknown programme code "NOPE"/);
  });
});

describe('commitStudentRow — parents', () => {
  it('creates a Parent when the phone is unknown', async () => {
    await commitStudentRow(
      { ...baseRow(), primaryParentPhone: '9111111111', primaryParentName: 'Ramesh Sharma' },
      ctx(),
    );
    expect(await Parent.countDocuments({ collegeId })).toBe(1);
  });

  it('links an existing Parent instead of creating a second', async () => {
    const parentPerson = await Person.create({ collegeId, name: 'Ramesh', phone: '9111111111' });
    await Parent.create({ collegeId, personId: parentPerson._id });
    await commitStudentRow({ ...baseRow(), primaryParentPhone: '9111111111' }, ctx());
    expect(await Parent.countDocuments({ collegeId })).toBe(1);
  });
});

describe('parentExistsByPhone', () => {
  it('is false when no parent has that phone', async () => {
    const { parentExistsByPhone } = await import('../student-import-service');
    expect(await parentExistsByPhone(collegeId, '9111111111')).toBe(false);
  });

  it('is true for an existing parent, and writes nothing', async () => {
    const { parentExistsByPhone } = await import('../student-import-service');
    const p = await Person.create({ collegeId, name: 'R', phone: '9111111111' });
    await Parent.create({ collegeId, personId: p._id });
    expect(await parentExistsByPhone(collegeId, '9111111111')).toBe(true);
    expect(await Parent.countDocuments({ collegeId })).toBe(1);
  });
});

describe('commitStudentRow — update', () => {
  it('updates the matched student rather than creating a duplicate', async () => {
    const first = await commitStudentRow({ ...baseRow(), rollNumber: 'R1' }, ctx());
    const second = await commitStudentRow({ ...baseRow(), rollNumber: 'R1', category: 'OC' }, ctx());
    expect(second.id).toBe(first.id);
    expect(await Student.countDocuments({ collegeId })).toBe(1);
  });
});

describe('commitStudentRow — blocked', () => {
  it('refuses to write a sealed student', async () => {
    const { id } = await commitStudentRow({ ...baseRow(), rollNumber: 'R1' }, ctx());
    await Student.findByIdAndUpdate(id, { isSealed: true });
    await expect(
      commitStudentRow({ ...baseRow(), rollNumber: 'R1', category: 'OC' }, ctx()),
    ).rejects.toThrow(/sealed/i);
    expect((await Student.findById(id))!.category).toBeUndefined();
  });
});

describe('commitStudentRow — compensating rollback', () => {
  it('leaves no orphan Person when the Student write fails', async () => {
    // Force the Student create to fail AFTER the Person is written. This is
    // the realistic partial-write: a duplicate rollNumber surfacing at the
    // final insert. Without rollback the Person survives as an orphan.
    vi.spyOn(Student, 'create').mockRejectedValueOnce(new Error('E11000 duplicate key'));

    await expect(commitStudentRow(baseRow(), ctx())).rejects.toThrow(/duplicate key/);
    expect(await Person.countDocuments({ collegeId })).toBe(0);
  });

  it('removes a parent created earlier in the same failed row', async () => {
    vi.spyOn(Student, 'create').mockRejectedValueOnce(new Error('boom'));

    await expect(
      commitStudentRow(
        { ...baseRow(), primaryParentPhone: '9111111111', primaryParentName: 'Ramesh' },
        ctx(),
      ),
    ).rejects.toThrow(/boom/);

    expect(await Parent.countDocuments({ collegeId })).toBe(0);
    expect(await Person.countDocuments({ collegeId })).toBe(0);
  });

  it('does NOT delete a pre-existing parent that was merely linked', async () => {
    const parentPerson = await Person.create({ collegeId, name: 'Ramesh', phone: '9111111111' });
    await Parent.create({ collegeId, personId: parentPerson._id });
    vi.spyOn(Student, 'create').mockRejectedValueOnce(new Error('boom'));

    await expect(
      commitStudentRow({ ...baseRow(), primaryParentPhone: '9111111111' }, ctx()),
    ).rejects.toThrow(/boom/);

    // Rollback must only undo what THIS row created.
    expect(await Parent.countDocuments({ collegeId })).toBe(1);
    expect(await Person.countDocuments({ collegeId })).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --root backend src/modules/people/__tests__/student-import-service.test.ts`
Expected: FAIL — cannot find module `../student-import-service`.

- [ ] **Step 3: Write the implementation**

Create `backend/src/modules/people/student-import-service.ts`:

```typescript
/**
 * Commit handler for the student bulk import.
 *
 * A single row can create up to three documents — Person, optionally
 * Parent + its Person, then Student. If the Student write fails (duplicate
 * rollNumber is the realistic case) the Person is already committed and
 * becomes an orphan; across a large file that is meaningful pollution, and it
 * is the only path here that corrupts data rather than merely rejecting input.
 *
 * The in-memory test harness is not a replica set, so session.withTransaction
 * is unavailable. This follows the compensating-rollback precedent documented
 * in modules/finance/programme-transfer-service.ts: track what this row
 * created and delete it in reverse order on failure.
 */
import { Person } from '../../models/people/Person';
import { Student } from '../../models/people/Student';
import { Parent } from '../../models/people/Parent';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { resolveStudentRefs, validateCatalogCodes } from './student-import-refs';
import { matchExistingStudent } from './student-import-match';

interface Ctx { collegeId: string; performedBy: string; }

/** Documents created while processing one row, newest last. */
interface Created { model: 'Person' | 'Parent' | 'Student'; id: unknown; }

function cell(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

async function rollback(created: Created[]): Promise<void> {
  for (let i = created.length - 1; i >= 0; i -= 1) {
    const c = created[i]!;
    try {
      if (c.model === 'Person') await Person.deleteOne({ _id: c.id });
      else if (c.model === 'Parent') await Parent.deleteOne({ _id: c.id });
      else await Student.deleteOne({ _id: c.id });
    } catch {
      // Best-effort. A failed compensation must not mask the original error.
    }
  }
}

/**
 * Link a guardian by phone, creating a minimal Parent + Person when absent.
 * Intake genuinely arrives parent-first and feeResponsibleParentId gates
 * onboarding completion, so requiring a prior parent import would make the
 * feature unusable for its main case.
 */
async function linkOrCreateParent(
  collegeId: string,
  phone: string,
  name: string,
  created: Created[],
): Promise<string> {
  const existingPerson = await Person.findOne({ collegeId, phone }).select('_id').lean();
  if (existingPerson) {
    const existingParent = await Parent.findOne({ collegeId, personId: existingPerson._id }).select('_id').lean();
    if (existingParent) return String(existingParent._id);

    const parent = await Parent.create({ collegeId, personId: existingPerson._id });
    created.push({ model: 'Parent', id: parent._id });
    return String(parent._id);
  }

  const person = await Person.create({ collegeId, name: name || `Guardian ${phone}`, phone });
  created.push({ model: 'Person', id: person._id });
  const parent = await Parent.create({ collegeId, personId: person._id });
  created.push({ model: 'Parent', id: parent._id });
  return String(parent._id);
}

/**
 * Read-only counterpart to linkOrCreateParent, for preview. Answers "would
 * this row create a guardian?" without writing anything.
 */
export async function parentExistsByPhone(collegeId: string, phone: string): Promise<boolean> {
  const person = await Person.findOne({ collegeId, phone }).select('_id').lean();
  if (!person) return false;
  const parent = await Parent.findOne({ collegeId, personId: person._id }).select('_id').lean();
  return Boolean(parent);
}

export async function commitStudentRow(
  typedRow: Record<string, unknown>,
  ctx: Ctx,
): Promise<{ id: string }> {
  const { collegeId, performedBy } = ctx;

  const catalog = await validateCatalogCodes(collegeId, typedRow);
  if (!catalog.ok) throw new AppError(400, catalog.error);

  const refs = await resolveStudentRefs(collegeId, typedRow);
  if (!refs.ok) throw new AppError(400, refs.error);

  const match = await matchExistingStudent(collegeId, typedRow);
  if (match.action === 'blocked') {
    throw new AppError(409, `Cannot import: ${match.reason}`);
  }

  const created: Created[] = [];
  try {
    // Guardians first — the Student references them.
    let primaryParentId: string | undefined;
    let feeResponsibleParentId: string | undefined;

    const primaryPhone = cell(typedRow, 'primaryParentPhone');
    if (primaryPhone) {
      primaryParentId = await linkOrCreateParent(
        collegeId, primaryPhone, cell(typedRow, 'primaryParentName'), created,
      );
    }
    const feePhone = cell(typedRow, 'feeResponsibleParentPhone');
    if (feePhone) {
      feeResponsibleParentId = feePhone === primaryPhone
        ? primaryParentId
        : await linkOrCreateParent(collegeId, feePhone, '', created);
    }

    const personFields = {
      name: cell(typedRow, 'name'),
      phone: cell(typedRow, 'phone'),
      ...(cell(typedRow, 'email') ? { email: cell(typedRow, 'email') } : {}),
      ...(cell(typedRow, 'gender') ? { gender: cell(typedRow, 'gender') } : {}),
      ...(cell(typedRow, 'dob') ? { dob: new Date(cell(typedRow, 'dob')) } : {}),
      ...(cell(typedRow, 'aadhaar') ? { aadhaar: cell(typedRow, 'aadhaar') } : {}),
      address: {
        line1: cell(typedRow, 'addressLine1') || undefined,
        line2: cell(typedRow, 'addressLine2') || undefined,
        city: cell(typedRow, 'city') || undefined,
        state: cell(typedRow, 'state') || undefined,
        pincode: cell(typedRow, 'pincode') || undefined,
      },
    };

    const studentFields: Record<string, unknown> = {
      collegeId,
      admissionYear: Number(cell(typedRow, 'admissionYear')),
      programmeId: refs.value.programmeId,
      ...(refs.value.branchId ? { branchId: refs.value.branchId } : {}),
      ...(refs.value.batchId ? { batchId: refs.value.batchId } : {}),
      ...(refs.value.regulationId ? { regulationId: refs.value.regulationId } : {}),
      ...(cell(typedRow, 'rollNumber') ? { rollNumber: cell(typedRow, 'rollNumber') } : {}),
      ...(cell(typedRow, 'quota') ? { quota: cell(typedRow, 'quota') } : {}),
      ...(cell(typedRow, 'category') ? { category: cell(typedRow, 'category') } : {}),
      ...(cell(typedRow, 'studyYearAtAdmission')
        ? { studyYearAtAdmission: Number(cell(typedRow, 'studyYearAtAdmission')) } : {}),
      // Imported students are normally already admitted; matches the
      // pre-existing importer rather than the model default of 'prospective'.
      status: cell(typedRow, 'status') || 'active',
      ...(cell(typedRow, 'onboardingStatus') ? { onboardingStatus: cell(typedRow, 'onboardingStatus') } : {}),
      ...(primaryParentId ? { primaryParentId } : {}),
      ...(feeResponsibleParentId ? { feeResponsibleParentId } : {}),
    };

    if (match.action === 'update' && match.studentId) {
      const existing = await Student.findOne({ _id: match.studentId, collegeId });
      if (!existing) throw new AppError(404, 'Matched student disappeared mid-import');
      await Person.updateOne({ _id: existing.personId, collegeId }, { $set: personFields });
      const { collegeId: _c, ...updatable } = studentFields;
      await Student.updateOne({ _id: existing._id, collegeId }, { $set: updatable });
      await createAuditLog({
        collegeId, entityType: 'Student', entityId: String(existing._id),
        entityName: personFields.name, action: 'update', changes: [], performedBy,
      });
      return { id: String(existing._id) };
    }

    const person = await Person.create({ collegeId, ...personFields });
    created.push({ model: 'Person', id: person._id });

    const student = await Student.create({ ...studentFields, personId: person._id });
    created.push({ model: 'Student', id: student._id });

    await createAuditLog({
      collegeId, entityType: 'Student', entityId: String(student._id),
      entityName: personFields.name, action: 'create', changes: [], performedBy,
    });

    return { id: String(student._id) };
  } catch (err) {
    await rollback(created);
    throw err;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --root backend src/modules/people/__tests__/student-import-service.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/people/student-import-service.ts \
        backend/src/modules/people/__tests__/student-import-service.test.ts
git commit -m "feat(people): student import commit with rollback and parent linking

Creates or updates a student from one validated row. Guardians are linked
by phone and created when absent, because intake arrives parent-first and
feeResponsibleParentId gates onboarding completion.

A row can write Person + Parent + Student; a failure at the Student insert
would otherwise strand an orphan Person. Uses the compensating-rollback
pattern documented in programme-transfer-service (no replica set in the
test harness, so withTransaction is unavailable), undoing only what this
row created — a pre-existing parent that was merely linked is untouched."
```

---

### Task 5: Async per-row validation hook in the engine

**Why this task exists.** `ImportSchemaField.validate` is **synchronous**
(`bulk-import-registry.ts:32-36`), so it cannot do database lookups. Without a
new hook, reference resolution (Task 2) and match classification (Task 3) can
only run at commit — meaning preview could not label rows Create/Update/Blocked
or report unknown codes, which the spec requires. This adds the one generic
extension point that makes preview honest.

**Files:**
- Modify: `backend/src/modules/platform/import-schemas/types.ts` (created in Task 6 — if Task 6 has not run yet, create it here by moving the three interfaces out of `bulk-import-registry.ts` as described in Task 6 Step 3)
- Modify: `backend/src/modules/platform/bulk-import-service.ts` (await the hook in `uploadAndValidate`; widen `ImportJobPreview`)
- Modify: `backend/src/models/platform/ImportJob.ts` (persist `action` + `notes` per result row)
- Test: `backend/src/modules/platform/__tests__/bulk-import-row-hook.test.ts`

**Interfaces:**
- Consumes: `ImportSchemaDefinition` from `./import-schemas/types`.
- Produces:
  - `export type ImportRowAction = 'create' | 'update' | 'blocked';` (in `import-schemas/types.ts`)
  - Optional member on `ImportSchemaDefinition`:
    ```typescript
    validateRow?: (
      typedRow: Record<string, unknown>,
      rawRow: Record<string, string>,
      ctx: ImportCommitContext,
    ) => Promise<
      | {
          ok: true;
          action: ImportRowAction;
          notes?: string[];
          resolved?: Record<string, string>;
          sideEffects?: Record<string, number>;
        }
      | { ok: false; error: string }
    >;
    ```
  - `ImportJobPreview` gains `actionCounts: { create: number; update: number; blocked: number }` and `sideEffectTotals: Record<string, number>`; each `previewRows[]` entry gains `action?: ImportRowAction`, `notes?: string[]` and `resolved?: Record<string, string>`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/platform/__tests__/bulk-import-row-hook.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import * as registry from '../bulk-import-registry';
import { uploadAndValidate } from '../bulk-import-service';
import type { ImportSchemaDefinition } from '../import-schemas/types';

const COLLEGE = '000000000000000000000001';

function fakeSchema(
  validateRow?: ImportSchemaDefinition['validateRow'],
): ImportSchemaDefinition {
  return {
    entityType: 'rowhook-fixture',
    label: 'Fixture',
    description: 'test only',
    fields: [
      {
        fieldKey: 'code', label: 'Code', type: 'string', required: true,
        validate: (raw: string) => raw.trim()
          ? { ok: true as const, value: raw.trim() }
          : { ok: false as const, error: 'required' },
      },
    ],
    sampleRow: { code: 'A' },
    validateRow,
    commitOne: async () => ({ id: 'x' }),
  };
}

async function run(def: ImportSchemaDefinition, csv: string) {
  vi.spyOn(registry, 'getImportSchema').mockReturnValue(def);
  return uploadAndValidate({
    collegeId: COLLEGE, performedBy: 'tester', entityType: def.entityType,
    fileBuffer: Buffer.from(csv), fileName: 'f.csv', declaredMime: 'text/csv',
  });
}

beforeAll(async () => { await setupMongo(); }, 60_000);
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); vi.restoreAllMocks(); });

describe('validateRow hook', () => {
  it('is optional — a schema without it still previews', async () => {
    const p = await run(fakeSchema(), 'code\nA');
    expect(p.validCount).toBe(1);
    expect(p.errorCount).toBe(0);
  });

  it('labels each row with the action the hook returns', async () => {
    const p = await run(
      fakeSchema(async (typed) => ({
        ok: true, action: typed.code === 'A' ? 'create' : 'update',
      })),
      'code\nA\nB',
    );
    expect(p.previewRows.map((r) => r.action)).toEqual(['create', 'update']);
    expect(p.actionCounts).toEqual({ create: 1, update: 1, blocked: 0 });
  });

  it('a hook rejection fails the row with its message', async () => {
    const p = await run(
      fakeSchema(async () => ({ ok: false, error: 'unknown programme code "NOPE"' })),
      'code\nA',
    );
    expect(p.validCount).toBe(0);
    expect(p.errorCount).toBe(1);
    expect(p.previewRows[0]!.errors[0]!.error).toBe('unknown programme code "NOPE"');
  });

  it('blocked rows are counted but not valid for commit', async () => {
    const p = await run(
      fakeSchema(async () => ({ ok: true, action: 'blocked', notes: ['record is sealed'] })),
      'code\nA',
    );
    expect(p.actionCounts.blocked).toBe(1);
    expect(p.validCount).toBe(0);
    expect(p.previewRows[0]!.notes).toEqual(['record is sealed']);
  });

  it('does not run the hook for a row that already failed field validation', async () => {
    const hook = vi.fn(async () => ({ ok: true as const, action: 'create' as const }));
    await run(fakeSchema(hook), 'code\n');
    expect(hook).not.toHaveBeenCalled();
  });

  it('surfaces notes so preview can report side effects before they happen', async () => {
    const p = await run(
      fakeSchema(async () => ({ ok: true, action: 'create', notes: ['will create 1 guardian'] })),
      'code\nA',
    );
    expect(p.previewRows[0]!.notes).toEqual(['will create 1 guardian']);
  });

  it('sums side-effect counters across every row, not just previewed ones', async () => {
    const p = await run(
      fakeSchema(async (typed) => ({
        ok: true,
        action: 'create',
        sideEffects: typed.code === 'A' ? { guardians: 2 } : { guardians: 1 },
      })),
      'code\nA\nB',
    );
    expect(p.sideEffectTotals).toEqual({ guardians: 3 });
  });

  it('leaves sideEffectTotals empty for a schema with no hook', async () => {
    const p = await run(fakeSchema(), 'code\nA');
    expect(p.sideEffectTotals).toEqual({});
  });

  it('echoes what the row\'s codes resolved to', async () => {
    const p = await run(
      fakeSchema(async () => ({
        ok: true, action: 'create', resolved: { Programme: 'BTech CSE', Branch: 'Computer Science' },
      })),
      'code\nA',
    );
    expect(p.previewRows[0]!.resolved).toEqual({
      Programme: 'BTech CSE', Branch: 'Computer Science',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --root backend src/modules/platform/__tests__/bulk-import-row-hook.test.ts`
Expected: FAIL — `actionCounts` undefined and `action` missing on preview rows.

- [ ] **Step 3: Add the type**

In `backend/src/modules/platform/import-schemas/types.ts` add:

```typescript
/**
 * What committing a row would do. Computed during preview by the optional
 * `validateRow` hook so the operator sees Create / Update / Blocked before
 * anything is written.
 */
export type ImportRowAction = 'create' | 'update' | 'blocked';
```

and add the optional member to `ImportSchemaDefinition`:

```typescript
  /**
   * Optional async per-row check, run after every field validator passes.
   *
   * `validate` is synchronous and therefore cannot hit the database, so
   * anything needing a lookup — resolving codes to ids, deciding whether a
   * row creates or updates — belongs here. Without it, preview could only
   * report shape errors and every reference problem would surface at commit,
   * after the operator has already confirmed.
   *
   * Returning `ok: false` fails the row exactly like a field validator.
   * `notes` are advisory strings shown in the preview (e.g. side effects the
   * commit would cause). `resolved` is a label -> display-value map echoing
   * what the row's codes resolved to, so the operator can confirm that
   * "BTCSE" really is the programme they meant before committing.
   *
   * `sideEffects` is a counter-name -> increment map summed across *every*
   * row into `sideEffectTotals`. Preview only returns the first
   * PREVIEW_SUCCESS_LIMIT rows, so a total like "guardians to create" cannot
   * be derived client-side from previewRows — it has to be accumulated here.
   */
  validateRow?: (
    typedRow: Record<string, unknown>,
    rawRow: Record<string, string>,
    ctx: ImportCommitContext,
  ) => Promise<
    | {
        ok: true;
        action: ImportRowAction;
        notes?: string[];
        resolved?: Record<string, string>;
        sideEffects?: Record<string, number>;
      }
    | { ok: false; error: string }
  >;
```

- [ ] **Step 4: Persist action and notes on the job**

In `backend/src/models/platform/ImportJob.ts`, add to the per-result subdocument
(alongside `outcome`, `error`, `raw`, `createdId`):

```typescript
    action: { type: String, enum: ['create', 'update', 'blocked'], required: false },
    notes: { type: [String], required: false },
    resolved: { type: Schema.Types.Mixed, required: false },
```

and add to the matching TypeScript interface for a result row:

```typescript
  action?: 'create' | 'update' | 'blocked';
  notes?: string[];
  resolved?: Record<string, string>;
```

- [ ] **Step 5: Await the hook in `uploadAndValidate`**

In `backend/src/modules/platform/bulk-import-service.ts`:

Widen `ImportJobPreview`:

```typescript
export interface ImportJobPreview {
  job: IImportJob;
  headers: string[];
  previewRows: Array<{
    row: number;
    raw: Record<string, string>;
    valid: boolean;
    errors: Array<{ field: string; error: string }>;
    action?: ImportRowAction;
    notes?: string[];
    /** Label -> display value for codes this row resolved (programme, branch). */
    resolved?: Record<string, string>;
  }>;
  validCount: number;
  errorCount: number;
  /** How many rows would create, update, or are blocked. */
  actionCounts: { create: number; update: number; blocked: number };
  /**
   * Schema-defined counters summed over every row — not just the previewed
   * ones. Empty for schemas without a validateRow hook.
   */
  sideEffectTotals: Record<string, number>;
}
```

Import the type: `import type { ImportRowAction } from './import-schemas/types';`

Declare the accumulator beside `errorCount`:

```typescript
  const actionCounts = { create: 0, update: 0, blocked: 0 };
  const sideEffectTotals: Record<string, number> = {};
```

Immediately after `const valid = errors.length === 0;` in the row loop, replace
that line and what follows with:

```typescript
    let valid = errors.length === 0;
    let action: ImportRowAction | undefined;
    let notes: string[] | undefined;
    let resolved: Record<string, string> | undefined;

    // Async row check — DB-backed validation the sync field validators
    // cannot do. Skipped for rows that already failed, so a broken row does
    // not cost a query.
    if (valid && def.validateRow) {
      // eslint-disable-next-line no-await-in-loop
      const rowRes = await def.validateRow(typedRow, rawObj, ctx);
      if (!rowRes.ok) {
        valid = false;
        errors.push({ field: '_row', error: rowRes.error });
      } else {
        action = rowRes.action;
        notes = rowRes.notes;
        resolved = rowRes.resolved;
        actionCounts[rowRes.action] += 1;
        for (const [key, n] of Object.entries(rowRes.sideEffects ?? {})) {
          sideEffectTotals[key] = (sideEffectTotals[key] ?? 0) + n;
        }
        // A blocked row is not an error, but must never reach commit.
        if (rowRes.action === 'blocked') valid = false;
      }
    }

    if (!valid) errorCount += 1;
```

Store `action` and `notes` on the pushed result and preview entries:

```typescript
    results.push({
      row: rowIdx,
      outcome: valid ? 'success' : 'error',
      error: valid ? undefined : errors.map((e) => `${e.field}: ${e.error}`).join('; '),
      raw: valid ? typedRow : rawObj,
      action,
      notes,
      resolved,
    });
```

```typescript
      previewRows.push({ row: rowIdx, raw: rawObj, valid, errors, action, notes, resolved });
```

Return `actionCounts` and `sideEffectTotals` in the preview object.

> `ctx` must exist before the row loop. If `uploadAndValidate` does not already
> declare it, add `const ctx = { collegeId, performedBy };` above the loop —
> `commitImportJob` declares it the same way.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run --root backend src/modules/platform/__tests__/bulk-import-row-hook.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 7: Confirm the other four entity types are unaffected**

None of faculty / staff / applicant / programme define `validateRow`, so their
behaviour must be byte-identical.

Run: `npx vitest run --root backend src/modules/platform`
Expected: PASS

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/platform/bulk-import-service.ts \
        backend/src/modules/platform/import-schemas/types.ts \
        backend/src/models/platform/ImportJob.ts \
        backend/src/modules/platform/__tests__/bulk-import-row-hook.test.ts
git commit -m "feat(bulk-import): optional async per-row validation hook

Field validators are synchronous and cannot hit the database, so reference
resolution and duplicate detection could only ever run at commit — after
the operator confirmed. Preview could not honestly label a row.

Adds an optional validateRow hook awaited after the field validators, with
per-row action (create/update/blocked), advisory notes and resolved-code
echoes surfaced in the preview, plus aggregate actionCounts. Blocked rows are excluded from commit
without being reported as errors.

Opt-in: the four entity types that do not define it are unchanged."
```

---

### Task 6: Enrich the student registry entry to 25 fields

Move the student schema out of the 795-line registry into its own file and
grow it, wiring in Tasks 2–4.

**Files:**
- Create: `backend/src/modules/platform/import-schemas/student.ts`
- Modify: `backend/src/modules/platform/bulk-import-registry.ts` (delete the inline `studentImportSchema`, import the new one)
- Test: `backend/src/modules/platform/__tests__/student-import-schema.test.ts`

**Interfaces:**
- Consumes: `commitStudentRow` from `../../people/student-import-service`; `ImportSchemaDefinition`, `ImportSchemaField` from `../bulk-import-registry`.
- Produces: `export const studentImportSchema: ImportSchemaDefinition`

> **Import-cycle note:** `bulk-import-registry` will import `import-schemas/student`,
> which imports the *types* from `bulk-import-registry`. Move
> `ImportSchemaField`, `ImportSchemaDefinition` and `ImportCommitContext` into
> `backend/src/modules/platform/import-schemas/types.ts` and have both files
> import from there. Re-export them from `bulk-import-registry` so existing
> importers keep working.

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/platform/__tests__/student-import-schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getImportSchema } from '../bulk-import-registry';

const REQUIRED = ['name', 'phone', 'programmeCode', 'admissionYear'];
const EXPECTED_KEYS = [
  'name', 'phone', 'email', 'gender', 'dob', 'aadhaar',
  'addressLine1', 'addressLine2', 'city', 'state', 'pincode',
  'programmeCode', 'branchCode', 'batchCode', 'regulationCode',
  'admissionYear', 'studyYearAtAdmission', 'rollNumber', 'quota',
  'category', 'status', 'onboardingStatus',
  'primaryParentPhone', 'primaryParentName', 'feeResponsibleParentPhone',
];

const FORBIDDEN = [
  'feeStatus', 'hasFinancialHold', 'feePins', 'isSealed',
  'graduationDate', 'exitDate', 'alumniId', 'finalCgpa',
];

describe('student import schema', () => {
  const def = getImportSchema('student');

  it('is registered', () => {
    expect(def).not.toBeNull();
  });

  it('exposes exactly the 25 operator-authored fields', () => {
    expect(def!.fields.map((f) => f.fieldKey).sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it('marks exactly the four mandatory fields required', () => {
    const required = def!.fields.filter((f) => f.required).map((f) => f.fieldKey).sort();
    expect(required).toEqual([...REQUIRED].sort());
  });

  it('never exposes a system-managed field', () => {
    const keys = def!.fields.map((f) => f.fieldKey);
    for (const f of FORBIDDEN) expect(keys).not.toContain(f);
  });

  it('has a sample value for every field so the template row is complete', () => {
    for (const f of def!.fields) {
      expect(Object.keys(def!.sampleRow)).toContain(f.fieldKey);
    }
  });

  it('rejects a blank required field', () => {
    const nameField = def!.fields.find((f) => f.fieldKey === 'name')!;
    const res = nameField.validate('', {}, { collegeId: 'c', performedBy: 'p' });
    expect(res.ok).toBe(false);
  });

  it('accepts a valid gender and rejects an invalid one', () => {
    const g = def!.fields.find((f) => f.fieldKey === 'gender')!;
    expect(g.validate('male', {}, { collegeId: 'c', performedBy: 'p' }).ok).toBe(true);
    expect(g.validate('helicopter', {}, { collegeId: 'c', performedBy: 'p' }).ok).toBe(false);
  });

  it('bounds studyYearAtAdmission to 1-8', () => {
    const y = def!.fields.find((f) => f.fieldKey === 'studyYearAtAdmission')!;
    expect(y.validate('1', {}, { collegeId: 'c', performedBy: 'p' }).ok).toBe(true);
    expect(y.validate('9', {}, { collegeId: 'c', performedBy: 'p' }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --root backend src/modules/platform/__tests__/student-import-schema.test.ts`
Expected: FAIL — the field list has 11 keys, not 25.

- [ ] **Step 3: Extract the shared types**

Create `backend/src/modules/platform/import-schemas/types.ts` by moving
`ImportCommitContext`, `ImportSchemaField` and `ImportSchemaDefinition`
verbatim out of `bulk-import-registry.ts` (they are at the top of that file),
adding `import { IImportJobSchemaField } from '../../../models/platform/ImportJob';`.

In `bulk-import-registry.ts`, replace those three declarations with:

```typescript
import type {
  ImportCommitContext, ImportSchemaField, ImportSchemaDefinition,
} from './import-schemas/types';

export type { ImportCommitContext, ImportSchemaField, ImportSchemaDefinition };
```

- [ ] **Step 4: Run the full platform suite to confirm the extraction is behaviour-neutral**

Run: `npx vitest run --root backend src/modules/platform`
Expected: PASS (unchanged from before the extraction)

- [ ] **Step 5: Create the enriched student schema**

First create `backend/src/modules/platform/import-schemas/validators.ts`.

Move `validString`, `validNumber` and `validEnum` **verbatim** out of
`bulk-import-registry.ts` (lines 60-100) and `export` each one. The registry
still needs them for the other four entity types, so import them back there
rather than duplicating.

`validDate`, `validPhone` and `validAadhaar` do **not** exist — the current
student schema inlines those checks. Add them to the same file:

```typescript
type Res<T> = { ok: true; value: T } | { ok: false; error: string };

export function validPhone(opts: { required: boolean }) {
  return (raw: string): Res<string> => {
    const v = raw.trim();
    if (!v) return opts.required ? { ok: false, error: "required" } : { ok: true, value: "" };
    if (!/^[0-9]{10}$/.test(v)) return { ok: false, error: "must be a 10-digit phone number" };
    return { ok: true, value: v };
  };
}

export function validAadhaar(opts: { required: boolean }) {
  return (raw: string): Res<string> => {
    const v = raw.trim();
    if (!v) return opts.required ? { ok: false, error: "required" } : { ok: true, value: "" };
    if (!/^[0-9]{12}$/.test(v)) return { ok: false, error: "must be 12 digits" };
    return { ok: true, value: v };
  };
}

export function validDate(opts: { required: boolean }) {
  return (raw: string): Res<string> => {
    const v = raw.trim();
    if (!v) return opts.required ? { ok: false, error: "required" } : { ok: true, value: "" };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, error: "must be YYYY-MM-DD" };
    if (Number.isNaN(new Date(v).getTime())) return { ok: false, error: "not a real date" };
    return { ok: true, value: v };
  };
}

export function validEmail(opts: { required: boolean }) {
  return (raw: string): Res<string> => {
    const v = raw.trim();
    if (!v) return opts.required ? { ok: false, error: "required" } : { ok: true, value: "" };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { ok: false, error: "invalid email format" };
    return { ok: true, value: v };
  };
}
```

Then create `backend/src/modules/platform/import-schemas/student.ts`:

```typescript
import { commitStudentRow, parentExistsByPhone } from '../../people/student-import-service';
import { resolveStudentRefs, validateCatalogCodes } from '../../people/student-import-refs';
import { matchExistingStudent } from '../../people/student-import-match';
import type { ImportSchemaDefinition } from './types';
import { validString, validNumber, validEnum, validDate, validPhone, validAadhaar, validEmail } from './validators';

/**
 * Student bulk-import schema — 25 operator-authored fields.
 *
 * Deliberately excludes everything the payment and lifecycle pipelines own
 * (feeStatus, hasFinancialHold, feePins, isSealed, graduationDate, exitDate,
 * alumniId, finalCgpa). Letting a spreadsheet write those recreates the
 * corrupted-derived-field bug class fixed in the Jul-2026 audit pass.
 *
 * `programmeCode` is required even though `programmeId` is optional on the
 * model: a student with no programme cannot be fee-pinned or placed, so
 * importing one creates downstream work rather than saving it.
 */
export const studentImportSchema: ImportSchemaDefinition = {
  entityType: 'student',
  label: 'Students',
  description:
    'Bulk-create or update students. Identity, academic placement and guardians. '
    + 'Mandatory columns are marked with * in the template. Re-uploading a corrected '
    + 'file is safe — rows match on roll number, then Aadhaar, then phone + admission year.',
  fields: [
    // ── Identity → Person ──
    { fieldKey: 'name', label: 'Full Name *', type: 'string', required: true, validate: validString({ required: true, min: 1, max: 200 }) },
    { fieldKey: 'phone', label: 'Phone (10 digits) *', type: 'string', required: true, validate: validPhone({ required: true }) },
    { fieldKey: 'email', label: 'Email', type: 'string', required: false, validate: validEmail({ required: false }) },
    { fieldKey: 'gender', label: 'Gender', type: 'enum', required: false, meta: { values: ['male', 'female', 'other'] }, validate: validEnum({ required: false, values: ['male', 'female', 'other'] }) },
    { fieldKey: 'dob', label: 'Date of Birth (YYYY-MM-DD)', type: 'date', required: false, validate: validDate({ required: false }) },
    { fieldKey: 'aadhaar', label: 'Aadhaar (12 digits)', type: 'string', required: false, validate: validAadhaar({ required: false }) },
    { fieldKey: 'addressLine1', label: 'Address Line 1', type: 'string', required: false, validate: validString({ required: false, max: 200 }) },
    { fieldKey: 'addressLine2', label: 'Address Line 2', type: 'string', required: false, validate: validString({ required: false, max: 200 }) },
    { fieldKey: 'city', label: 'City', type: 'string', required: false, validate: validString({ required: false, max: 100 }) },
    { fieldKey: 'state', label: 'State', type: 'string', required: false, validate: validString({ required: false, max: 100 }) },
    { fieldKey: 'pincode', label: 'Pincode', type: 'string', required: false, validate: validString({ required: false, max: 10 }) },

    // ── Placement → Student ──
    { fieldKey: 'programmeCode', label: 'Programme Code *', type: 'string', required: true, validate: validString({ required: true, max: 50 }) },
    { fieldKey: 'branchCode', label: 'Branch Code', type: 'string', required: false, validate: validString({ required: false, max: 50 }) },
    { fieldKey: 'batchCode', label: 'Batch Code', type: 'string', required: false, validate: validString({ required: false, max: 50 }) },
    { fieldKey: 'regulationCode', label: 'Regulation Code', type: 'string', required: false, validate: validString({ required: false, max: 50 }) },
    { fieldKey: 'admissionYear', label: 'Admission Year *', type: 'number', required: true, validate: validNumber({ required: true, min: 2000, max: 2100 }) },
    { fieldKey: 'studyYearAtAdmission', label: 'Year of Study at Admission (1-8)', type: 'number', required: false, validate: validNumber({ required: false, min: 1, max: 8 }) },
    { fieldKey: 'rollNumber', label: 'Roll Number', type: 'string', required: false, validate: validString({ required: false, max: 50 }) },
    { fieldKey: 'quota', label: 'Quota Code', type: 'string', required: false, validate: validString({ required: false, max: 50 }) },
    { fieldKey: 'category', label: 'Category Code', type: 'string', required: false, validate: validString({ required: false, max: 50 }) },
    { fieldKey: 'status', label: 'Status', type: 'enum', required: false, meta: { values: ['prospective', 'active'] }, validate: validEnum({ required: false, values: ['prospective', 'active'] }) },
    { fieldKey: 'onboardingStatus', label: 'Onboarding Status', type: 'enum', required: false, meta: { values: ['not_started', 'in_progress', 'completed'] }, validate: validEnum({ required: false, values: ['not_started', 'in_progress', 'completed'] }) },

    // ── Guardians ──
    { fieldKey: 'primaryParentPhone', label: 'Primary Guardian Phone', type: 'string', required: false, validate: validPhone({ required: false }) },
    { fieldKey: 'primaryParentName', label: 'Primary Guardian Name', type: 'string', required: false, validate: validString({ required: false, max: 200 }) },
    { fieldKey: 'feeResponsibleParentPhone', label: 'Fee-Responsible Guardian Phone', type: 'string', required: false, validate: validPhone({ required: false }) },
  ],
  sampleRow: {
    name: 'Aarav Sharma', phone: '9876543210', email: 'aarav.sharma@example.edu',
    gender: 'male', dob: '2005-03-15', aadhaar: '234567890101',
    addressLine1: '12 MG Road', addressLine2: '', city: 'Hyderabad', state: 'Telangana', pincode: '500001',
    programmeCode: 'BTCSE', branchCode: 'CSE', batchCode: 'B2025', regulationCode: 'R20',
    admissionYear: '2025', studyYearAtAdmission: '1', rollNumber: '25B01A0501',
    quota: 'convener', category: 'OC', status: 'active', onboardingStatus: 'not_started',
    primaryParentPhone: '9811111111', primaryParentName: 'Ramesh Sharma',
    feeResponsibleParentPhone: '9811111111',
  },
  /**
   * Runs at preview. Field validators are synchronous, so every DB-backed
   * check lives here: resolve the codes, validate the catalogs, and decide
   * whether committing this row would create, update, or is blocked.
   * Without this the operator would confirm an import before learning that
   * half the programme codes are typos.
   */
  async validateRow(typedRow, _rawRow, ctx) {
    const catalog = await validateCatalogCodes(ctx.collegeId, typedRow);
    if (!catalog.ok) return { ok: false, error: catalog.error };

    const refs = await resolveStudentRefs(ctx.collegeId, typedRow);
    if (!refs.ok) return { ok: false, error: refs.error };

    // Echo the resolution back so the operator can confirm "BTCSE" is the
    // programme they meant, rather than only that some programme matched.
    const resolved: Record<string, string> = { Programme: refs.value.programmeName };
    if (refs.value.branchName) resolved.Branch = refs.value.branchName;

    const match = await matchExistingStudent(ctx.collegeId, typedRow);
    if (match.action === 'blocked') {
      return { ok: true, action: 'blocked', notes: [match.reason ?? 'blocked'], resolved };
    }

    // Report guardian side effects before they happen. Both columns can name
    // the same person, so dedupe within the row — across rows the total is an
    // upper bound, which is why the UI says "up to".
    const notes: string[] = [];
    const phones = new Set(
      ['primaryParentPhone', 'feeResponsibleParentPhone']
        .map((k) => String(typedRow[k] ?? '').trim())
        .filter(Boolean),
    );
    let guardiansToCreate = 0;
    for (const phone of phones) {
      if (!(await parentExistsByPhone(ctx.collegeId, phone))) {
        notes.push(`will create a guardian for ${phone}`);
        guardiansToCreate += 1;
      }
    }

    return {
      ok: true,
      action: match.action,
      notes: notes.length ? notes : undefined,
      resolved,
      sideEffects: guardiansToCreate ? { guardians: guardiansToCreate } : undefined,
    };
  },
  commitOne: (typedRow, ctx) => commitStudentRow(typedRow, ctx),
};
```

Note: `status` is limited to `prospective | active` in the template — the other
model statuses are lifecycle outcomes, not intake values.

- [ ] **Step 6: Wire it into the registry**

In `bulk-import-registry.ts`, delete the inline `const studentImportSchema` block
and add at the top:

```typescript
import { studentImportSchema } from './import-schemas/student';
```

Leave the registry array entry referencing `studentImportSchema` unchanged.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run --root backend src/modules/platform`
Expected: PASS, including the 8 new schema tests.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/platform/import-schemas backend/src/modules/platform/bulk-import-registry.ts \
        backend/src/modules/platform/__tests__/student-import-schema.test.ts
git commit -m "feat(bulk-import): student schema grows to 25 fields

Adds address, academic placement (programme/branch/batch/regulation, year
of study) and guardian columns, so an imported student no longer needs
manual completion. Commit delegates to the people-module handler with
upsert, parent linking and rollback.

Excludes every system-managed field by design. programmeCode is required
even though programmeId is optional on the model, because a student with
no programme cannot be fee-pinned.

Extracted the schema out of the 795-line registry into import-schemas/,
with the shared types and validators alongside, so the registry stays a
registry."
```

---

### Task 7: People-gated façade routes

**Files:**
- Create: `backend/src/modules/people/student-import-controller.ts`
- Modify: `backend/src/modules/people/routes.ts` (add three routes)
- Test: `backend/src/__e2e__/modules/student-import.e2e.test.ts`

**Interfaces:**
- Consumes: `uploadAndValidate`, `commitImportJob`, `getImportSchema`.
- Produces: three handlers — `templateHandler`, `previewHandler`, `commitHandler`, plus `studentImportUpload` (multer instance).

- [ ] **Step 1: Write the failing e2e test**

Create `backend/src/__e2e__/modules/student-import.e2e.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestUser } from '../factories/user.factory';

let api: TestApi;
let fx: BaseFixtures;
let registrar: Awaited<ReturnType<typeof createTestUser>>;

beforeAll(async () => {
  const app = await getTestApp();
  fx = await seedBase();
  registrar = await createTestUser({
    collegeId: fx.collegeId, role: 'staff', personaType: 'ST-REG',
    email: 'registrar@test.com',
  });
  api = createTestApi(app);
});

afterAll(async () => { await cleanupTestApp(); });

describe('GET /api/people/students/import/template', () => {
  it('returns the schema with mandatory fields marked', async () => {
    const res = await api.as(fx.admin.token).get('/api/people/students/import/template');
    expect(res.status).toBe(200);
    expect(res.body.entityType).toBe('student');
    expect(res.body.fields.length).toBe(25);
    const required = res.body.fields.filter((f: any) => f.required).map((f: any) => f.fieldKey);
    expect(required.sort()).toEqual(['admissionYear', 'name', 'phone', 'programmeCode']);
  });

  it('401 without auth', async () => {
    const res = await api.get('/api/people/students/import/template');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/people/students/import/preview', () => {
  it('accepts a template-shaped CSV with asterisk headers', async () => {
    const csv = [
      'name*,phone*,programmeCode*,admissionYear*',
      'Aarav Sharma,9876543210,BTCSE,2025',
    ].join('\n');

    const res = await api.as(fx.admin.token)
      .post('/api/people/students/import/preview')
      .attach('file', Buffer.from(csv), { filename: 'students.csv', contentType: 'text/csv' });

    expect(res.status).toBe(201);
    // The asterisk headers must map onto fieldKeys — otherwise every
    // required field reads empty and the row fails.
    expect(res.body.previewRows[0].errors).toEqual([]);
  });

  it('a Registrar can preview — the whole reason this facade exists', async () => {
    const csv = 'name*,phone*,programmeCode*,admissionYear*\nB,9876543211,BTCSE,2025';
    const res = await api.as(registrar.token)
      .post('/api/people/students/import/preview')
      .attach('file', Buffer.from(csv), { filename: 's.csv', contentType: 'text/csv' });
    expect(res.status).not.toBe(403);
  });

  it('401 without auth', async () => {
    const res = await api.post('/api/people/students/import/preview').send({});
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --root backend --config vitest.e2e.config.ts src/__e2e__/modules/student-import.e2e.test.ts`
Expected: FAIL — 404 on all three routes.

> If `createTestUser` does not accept `personaType`, check its signature in
> `backend/src/__e2e__/factories/user.factory.ts` and adjust the call. Do not
> drop the registrar test.

- [ ] **Step 3: Write the controller**

Create `backend/src/modules/people/student-import-controller.ts`:

```typescript
/**
 * People-gated facade over the shared bulk-import engine, scoped to students.
 *
 * Exists because only admin and principal hold platform:create (see
 * shared/rbac/defaults.ts), so a Registrar — who owns student data — gets a
 * 403 from /platform/bulk-imports. These routes are authorize('people', ...)
 * and delegate to the same service, so there is still one import engine.
 */
import { Response, NextFunction } from 'express';
import multer from 'multer';
import { AuthRequest } from '../../shared/types';
import { AppError } from '../../middleware/errorHandler';
import {
  uploadAndValidate, commitImportJob, IMPORT_FILE_MAX_BYTES,
} from '../platform/bulk-import-service';
import { getImportSchema } from '../platform/bulk-import-registry';

const ENTITY_TYPE = 'student';

export const studentImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMPORT_FILE_MAX_BYTES },
});

export async function templateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const def = getImportSchema(ENTITY_TYPE);
    if (!def) throw new AppError(500, 'Student import schema is not registered.');
    res.json({
      entityType: def.entityType,
      label: def.label,
      description: def.description,
      fields: def.fields.map(({ fieldKey, label, type, required, meta }) => ({
        fieldKey, label, type, required, meta,
      })),
      sampleRow: def.sampleRow,
    });
  } catch (e) { next(e); }
}

export async function previewHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError(400, 'No file uploaded. Attach a .csv as "file".');
    const preview = await uploadAndValidate({
      collegeId: req.collegeId!,
      performedBy: req.user?.name ?? 'System',
      entityType: ENTITY_TYPE,
      fileBuffer: req.file.buffer,
      fileName: req.file.originalname,
      declaredMime: req.file.mimetype,
    });
    res.status(201).json(preview);
  } catch (e) { next(e); }
}

export async function commitHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { jobId } = req.body as { jobId?: string };
    if (!jobId) throw new AppError(400, 'jobId is required.');
    const job = await commitImportJob(req.collegeId!, jobId, req.user?.name ?? 'System');
    res.json(job);
  } catch (e) { next(e); }
}
```

- [ ] **Step 4: Register the routes**

In `backend/src/modules/people/routes.ts`, add near the other `/students`
routes — **before** any `/students/:id` route, so the static path is not
swallowed by the id matcher:

```typescript
// ── Student bulk import ────────────────────────────────────
// people-gated facade over the shared import engine; see
// student-import-controller.ts for why this exists alongside
// /platform/bulk-imports.
router.get('/students/import/template', authorize('people', 'read'), studentImportCtrl.templateHandler);
router.post(
  '/students/import/preview',
  authorize('people', 'create'),
  studentImportCtrl.studentImportUpload.single('file'),
  studentImportCtrl.previewHandler,
);
router.post('/students/import/commit', authorize('people', 'create'), studentImportCtrl.commitHandler);
```

and at the top: `import * as studentImportCtrl from './student-import-controller';`

- [ ] **Step 5: Run the e2e test**

Run: `npx vitest run --root backend --config vitest.e2e.config.ts src/__e2e__/modules/student-import.e2e.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Confirm route ordering did not break student CRUD**

Run: `npx vitest run --root backend --config vitest.e2e.config.ts`
Expected: PASS — no existing people e2e test regressed.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/people/student-import-controller.ts \
        backend/src/modules/people/routes.ts \
        backend/src/__e2e__/modules/student-import.e2e.test.ts
git commit -m "feat(people): people-gated student import routes

Adds /students/import/{template,preview,commit} under authorize('people'),
delegating to the shared bulk-import service. Only admin and principal hold
platform:create, so a Registrar could not use /platform/bulk-imports at all
— this facade is what makes the feature usable by the persona that owns
student records. Static paths registered before /students/:id."
```

---

### Task 8: Frontend service + template download

**Files:**
- Create: `admin-portal/src/services/student-import.ts`
- Test: `admin-portal/src/services/__tests__/student-import.test.ts`

**Interfaces:**
- Produces:
  - `export interface ImportField { fieldKey: string; label: string; type: string; required: boolean; meta?: Record<string, unknown>; }`
  - `export interface ImportTemplate { entityType: string; label: string; description: string; fields: ImportField[]; sampleRow: Record<string, string>; }`
  - `export const getStudentImportTemplate: () => Promise<ImportTemplate>`
  - `export type ImportRowAction = 'create' | 'update' | 'blocked';`
  - `export interface ImportPreviewRow { row: number; raw: Record<string, string>; valid: boolean; errors: Array<{ field: string; error: string }>; action?: ImportRowAction; notes?: string[]; resolved?: Record<string, string>; }`
  - `export interface ImportPreview { job: { _id: string }; headers: string[]; previewRows: ImportPreviewRow[]; validCount: number; errorCount: number; actionCounts: { create: number; update: number; blocked: number }; sideEffectTotals: Record<string, number>; }`
  - `export const previewStudentImport: (file: File) => Promise<ImportPreview>`
  - `export const commitStudentImport: (jobId: string) => Promise<{ successCount: number; errorCount: number }>`
  - `export function buildTemplateCsv(tpl: ImportTemplate): string`

- [ ] **Step 1: Write the failing test**

Create `admin-portal/src/services/__tests__/student-import.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildTemplateCsv, type ImportTemplate } from '../student-import';

const tpl: ImportTemplate = {
  entityType: 'student',
  label: 'Students',
  description: 'x',
  fields: [
    { fieldKey: 'name', label: 'Full Name *', type: 'string', required: true },
    { fieldKey: 'email', label: 'Email', type: 'string', required: false },
    { fieldKey: 'city', label: 'City', type: 'string', required: false },
  ],
  sampleRow: { name: 'Aarav Sharma', email: 'a@b.c', city: 'Hyderabad, TS' },
};

describe('buildTemplateCsv', () => {
  it('marks mandatory columns with a trailing asterisk', () => {
    const [header] = buildTemplateCsv(tpl).split('\n');
    expect(header).toBe('name*,email,city');
  });

  it('includes the sample row', () => {
    const [, sample] = buildTemplateCsv(tpl).split('\n');
    expect(sample).toBe('Aarav Sharma,a@b.c,"Hyderabad, TS"');
  });

  it('quotes values containing a comma, quote or newline', () => {
    const csv = buildTemplateCsv({
      ...tpl,
      fields: [{ fieldKey: 'a', label: 'A', type: 'string', required: false }],
      sampleRow: { a: 'has "quote"' },
    });
    expect(csv.split('\n')[1]).toBe('"has ""quote"""');
  });

  it('emits an empty cell for a field with no sample', () => {
    const csv = buildTemplateCsv({
      ...tpl,
      fields: [{ fieldKey: 'z', label: 'Z', type: 'string', required: false }],
      sampleRow: {},
    });
    expect(csv.split('\n')[1]).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --root admin-portal src/services/__tests__/student-import.test.ts`
Expected: FAIL — cannot find module `../student-import`.

- [ ] **Step 3: Write the service**

Create `admin-portal/src/services/student-import.ts`:

```typescript
import api from './api';

const BASE = '/people/students/import';

export interface ImportField {
  fieldKey: string;
  label: string;
  type: string;
  required: boolean;
  meta?: Record<string, unknown>;
}

export interface ImportTemplate {
  entityType: string;
  label: string;
  description: string;
  fields: ImportField[];
  sampleRow: Record<string, string>;
}

/** What committing a row would do, as computed during preview. */
export type ImportRowAction = 'create' | 'update' | 'blocked';

export interface ImportPreviewRow {
  row: number;
  raw: Record<string, string>;
  valid: boolean;
  errors: Array<{ field: string; error: string }>;
  action?: ImportRowAction;
  /** Advisory side effects the commit would cause, e.g. guardians created. */
  notes?: string[];
  /** Label -> display value for the codes this row resolved. */
  resolved?: Record<string, string>;
}

export interface ImportPreview {
  job: { _id: string };
  headers: string[];
  previewRows: ImportPreviewRow[];
  validCount: number;
  errorCount: number;
  actionCounts: { create: number; update: number; blocked: number };
  /**
   * Counters summed server-side over every row. `previewRows` is capped at 50,
   * so these cannot be recomputed in the browser.
   */
  sideEffectTotals: Record<string, number>;
}

export const getStudentImportTemplate = (): Promise<ImportTemplate> =>
  api.get(`${BASE}/template`).then((r) => r.data);

export const previewStudentImport = (file: File): Promise<ImportPreview> => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`${BASE}/preview`, form).then((r) => r.data);
};

export const commitStudentImport = (
  jobId: string,
): Promise<{ successCount: number; errorCount: number }> =>
  api.post(`${BASE}/commit`, { jobId }).then((r) => r.data);

function csvCell(value: string): string {
  return /[,"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Build the downloadable template.
 *
 * Mandatory columns get a trailing `*` so the operator can see what is
 * required without opening the schema panel. The server strips that marker
 * on upload (normalizeImportHeader), which is what makes the round-trip work.
 */
export function buildTemplateCsv(tpl: ImportTemplate): string {
  const header = tpl.fields
    .map((f) => (f.required ? `${f.fieldKey}*` : f.fieldKey))
    .join(',');
  const sample = tpl.fields
    .map((f) => csvCell(tpl.sampleRow[f.fieldKey] ?? ''))
    .join(',');
  return `${header}\n${sample}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --root admin-portal src/services/__tests__/student-import.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/services/student-import.ts \
        admin-portal/src/services/__tests__/student-import.test.ts
git commit -m "feat(portal): student import service and template builder

buildTemplateCsv marks mandatory columns with a trailing asterisk so the
operator can see what is required without reading the schema panel. The
server strips the marker on upload, which is what makes the round-trip
work."
```

---

### Task 9: Import drawer + Students page entry points

**Files:**
- Create: `admin-portal/src/components/people/StudentImportDrawer.tsx`
- Modify: `admin-portal/src/pages/people/StudentsPage.tsx` (header controls + drawer state)
- Test: `e2e/tests/student-import.spec.ts`

**Interfaces:**
- Consumes: everything exported from `services/student-import`; `confirmAction` from `stores/confirmStore`.
- Produces: `export default function StudentImportDrawer({ open, onClose }: { open: boolean; onClose: () => void })`

- [ ] **Step 1: Write the drawer**

Create `admin-portal/src/components/people/StudentImportDrawer.tsx`:

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Download, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import { confirmAction } from '../../stores/confirmStore';
import {
  getStudentImportTemplate, previewStudentImport, commitStudentImport, buildTemplateCsv,
  type ImportPreview, type ImportPreviewRow,
} from '../../services/student-import';

interface Props { open: boolean; onClose: () => void; }

export default function StudentImportDrawer({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const { data: tpl } = useQuery({
    queryKey: ['student-import-template'],
    queryFn: getStudentImportTemplate,
    enabled: open,
  });

  const previewMut = useMutation({
    mutationFn: () => previewStudentImport(file!),
    // Preview failures are shown in the drawer itself; the global toast
    // handler would duplicate them. `silentError` is the flag main.tsx reads.
    meta: { silentError: true },
    onSuccess: setPreview,
  });

  const commitMut = useMutation({
    mutationFn: (jobId: string) => commitStudentImport(jobId),
    meta: { successMessage: 'Import committed' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['people-stats'] });
      reset();
      onClose();
    },
  });

  function reset() { setFile(null); setPreview(null); }

  function downloadTemplate() {
    if (!tpl) return;
    const blob = new Blob([buildTemplateCsv(tpl)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleCommit() {
    if (!preview?.job?._id) return;
    const ok = await confirmAction({
      title: `Import ${preview.validCount} student${preview.validCount === 1 ? '' : 's'}?`,
      message: [
        `${preview.actionCounts.create} created, ${preview.actionCounts.update} updated.`,
        preview.actionCounts.blocked > 0
          ? `${preview.actionCounts.blocked} blocked row(s) will be skipped.` : '',
        preview.errorCount > 0 ? `${preview.errorCount} row(s) with errors will be skipped.` : '',
        (preview.sideEffectTotals.guardians ?? 0) > 0
          ? `Up to ${preview.sideEffectTotals.guardians} guardian record(s) will also be created.` : '',
      ].filter(Boolean).join(' '),
      confirmLabel: 'Import',
    });
    if (ok.confirmed) commitMut.mutate(String(preview.job._id));
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Import students"
      widthClass="max-w-3xl"
      description="Upload a CSV. Mandatory columns are marked with * in the template."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm text-slate-600">
            Start from the template so the column names match.
          </p>
          <button
            type="button"
            onClick={downloadTemplate}
            disabled={!tpl}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Download size={14} /> Download template
          </button>
        </div>

        {!preview && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="student-import-file">
              CSV file
            </label>
            <input
              id="student-import-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={!file || previewMut.isPending}
              onClick={() => previewMut.mutate()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
            >
              {previewMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {previewMut.isPending ? 'Checking…' : 'Preview'}
            </button>
            {previewMut.isError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {(previewMut.error as any)?.response?.data?.error ?? 'Could not read that file.'}
              </p>
            )}
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm" data-testid="import-summary">
              <span className="inline-flex items-center gap-1 text-teal-700">
                <CheckCircle2 size={14} /> {preview.actionCounts.create} new
              </span>
              <span className="inline-flex items-center gap-1 text-primary-700">
                {preview.actionCounts.update} updates
              </span>
              {preview.actionCounts.blocked > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  {preview.actionCounts.blocked} blocked
                </span>
              )}
              {preview.errorCount > 0 && (
                <span className="inline-flex items-center gap-1 text-red-600">
                  <XCircle size={14} /> {preview.errorCount} with errors
                </span>
              )}
              {(preview.sideEffectTotals.guardians ?? 0) > 0 && (
                <span className="text-gray-600">
                  up to {preview.sideEffectTotals.guardians} guardian
                  {preview.sideEffectTotals.guardians === 1 ? '' : 's'} will be created
                </span>
              )}
            </div>

            <div className="max-h-72 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Row</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Resolves to</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.previewRows.map((r: ImportPreviewRow) => (
                    <tr key={r.row}>
                      <td className="px-3 py-2">{r.row}</td>
                      <td className="px-3 py-2">{r.raw?.name ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {r.resolved
                          ? Object.entries(r.resolved).map(([k, v]) => `${k}: ${v}`).join(' · ')
                          : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={
                            r.action === 'blocked' ? 'warning'
                              : r.valid ? (r.action === 'update' ? 'info' : 'success')
                                : 'danger'
                          }
                        >
                          {r.action === 'blocked' ? 'Blocked'
                            : r.valid ? (r.action === 'update' ? 'Update' : 'Create')
                              : 'Error'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className="text-red-600">
                          {r.errors.map((e) => `${e.field}: ${e.error}`).join('; ')}
                        </span>
                        {r.notes?.length ? (
                          <span className="block text-amber-700">{r.notes.join('; ')}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button type="button" onClick={reset} className="rounded-lg border px-4 py-2 text-sm">
                Choose another file
              </button>
              <button
                type="button"
                disabled={preview.validCount === 0 || commitMut.isPending}
                onClick={() => void handleCommit()}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
              >
                {commitMut.isPending ? 'Importing…' : `Import ${preview.validCount}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Add the entry point to StudentsPage**

In `admin-portal/src/pages/people/StudentsPage.tsx`:

Add imports:
```tsx
import { useState } from 'react';   // already imported — reuse
import { Upload } from 'lucide-react';
import StudentImportDrawer from '../../components/people/StudentImportDrawer';
import { useAuthStore } from '../../stores/authStore';
```

Add state inside the component:
```tsx
  const [importOpen, setImportOpen] = useState(false);
  const canCreate = useAuthStore((s) => s.hasPermission('people', 'create'));
```

Add the button immediately before the existing "Add Student" button in the
header `<div className="flex items-center gap-3">`:
```tsx
          {canCreate && (
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-primary-200 px-4 py-2 text-sm text-primary-700 transition hover:bg-primary-50"
            >
              <Upload size={16} /> Import
            </button>
          )}
```

Add the drawer just before the closing `</div>` of the page root:
```tsx
      <StudentImportDrawer open={importOpen} onClose={() => setImportOpen(false)} />
```

- [ ] **Step 3: Typecheck and build**

Run: `npm run typecheck && npm run build -w admin-portal`
Expected: no errors, build succeeds

- [ ] **Step 4: Write the Playwright test**

Create `e2e/tests/student-import.spec.ts`:

```typescript
import { test, expect } from './fixtures/auth-fixture';

test.describe('People — Student bulk import', () => {
  test('import drawer opens, template downloads, and a CSV previews', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/people/students');

    await page.getByRole('button', { name: /^import$/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Template downloads with asterisk-marked mandatory columns.
    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /download template/i }).click(),
    ]).then(([d]) => d);
    expect(download.suggestedFilename()).toBe('student-import-template.csv');

    // Upload a minimal file using the template's own header shape.
    const csv = 'name*,phone*,programmeCode*,admissionYear*\nE2E Import Student,9876500011,BTCSE,2025';
    await page.setInputFiles('#student-import-file', {
      name: 'students.csv', mimeType: 'text/csv', buffer: Buffer.from(csv),
    });
    await page.getByRole('button', { name: /^preview$/i }).click();

    await expect(page.getByTestId('import-summary')).toBeVisible({ timeout: 10_000 });
  });
});
```

> The commit half of the flow is exercised by the backend e2e test. This
> Playwright test stops at preview because committing depends on a seeded
> programme code, which the e2e seed does not currently guarantee. If
> `seedBase` gains a known programme code, extend this test to click Import
> and `await confirmDialog(page)` (importing the helper from
> `./utils/confirm-dialog` at that point — it is left out now because
> `noUnusedLocals` rejects an unused import).

- [ ] **Step 5: Run Playwright**

Start the stack (mongo + redis must be running):
```bash
VITE_API_URL=http://localhost:3003/api npm run build -w admin-portal
npx --workspace admin-portal vite preview --host 0.0.0.0 --port 5173 &
NODE_ENV=production MONGODB_URI=mongodb://localhost:27017/juvion_v2_e2e \
  REDIS_URL=redis://localhost:6379 JWT_SECRET=e2e-ci-secret \
  PAYMENT_WEBHOOK_SECRET=ci-dummy E2E_TESTING=1 PORT=3003 npm run dev -w backend &
```
Then: `cd e2e && E2E_BASE_URL=http://localhost:5173 E2E_BACKEND_URL=http://localhost:3003 npx playwright test tests/student-import.spec.ts`
Expected: PASS

- [ ] **Step 6: Run the whole Playwright suite for regressions**

Run: `cd e2e && npx playwright test`
Expected: PASS (30 tests — 29 existing + 1 new)

- [ ] **Step 7: Commit**

```bash
git add admin-portal/src/components/people/StudentImportDrawer.tsx \
        admin-portal/src/pages/people/StudentsPage.tsx \
        e2e/tests/student-import.spec.ts
git commit -m "feat(portal): student import drawer on the Students page

Adds Import and Download-template controls to /people/students, gated on
people:create to match the route. The drawer runs choose-file -> preview ->
commit against the people-scoped endpoints, showing per-row status and
errors before anything is written."
```

---

### Task 10: Full verification

- [ ] **Step 1: Typecheck all workspaces**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 2: Backend unit suite**

Run: `npx vitest run --root backend`
Expected: PASS. Baseline before this work was 1240/1240; this plan adds 53
backend unit tests (8+7+9+12+9+8 across Tasks 1-6), so expect 1293. If a single test fails, re-run it in isolation — this suite has a
known timing sensitivity under parallel load.

- [ ] **Step 3: Backend e2e suite**

Run: `npx vitest run --root backend --config vitest.e2e.config.ts`
Expected: PASS (baseline 292 + 5 new)

- [ ] **Step 4: Portal unit suite and build**

Run: `npm run test -w admin-portal && npm run build -w admin-portal`
Expected: PASS (baseline 115 + 4 new), build succeeds

- [ ] **Step 5: Playwright**

Run with the stack up (see Task 9 Step 5): `cd e2e && npx playwright test`
Expected: 30 passed

- [ ] **Step 6: Manual smoke of the platform surface**

Confirm `/platform/bulk-imports` still lists all five entity types and the
student template there now shows the enriched field set. This surface shares
the registry, so it must not have regressed.

- [ ] **Step 7: Commit any fixes and open the PR**

```bash
git push -u origin feat/student-bulk-import
gh pr create --base main --title "feat: bulk import of student data" \
  --body-file docs/superpowers/plans/2026-07-27-student-bulk-import-pr.md
```

---

## Notes for the implementer

- **Do not** add `feeStatus`, `hasFinancialHold`, `feePins`, `isSealed`,
  `graduationDate`, `exitDate`, `alumniId` or `finalCgpa` as importable
  columns, however convenient it seems. Those are written by the payment and
  lifecycle pipelines; a spreadsheet writing them is the bug class the Jul-2026
  audit pass removed.
- **Do not** replace the compensating rollback with `session.withTransaction`.
  The in-memory test harness is not a replica set. See
  `programme-transfer-service.ts:12-23`.
- The `*` marker is a two-way contract. If you change `buildTemplateCsv`
  (Task 8), you must change `normalizeImportHeader` (Task 1) to match, or the
  template stops importing.
