# Juvion v2 — Indian College ERP Platform

## Project Overview

Multi-tenant college ERP built as a MERN monorepo (MongoDB, Express, React 19, Node.js, TypeScript strict). Every data model and query is scoped by `collegeId` for multi-tenancy.

## Quick Start

```bash
# Prerequisites: Node >= 20, MongoDB 7 running on 27017, Redis 7 on 6379
# Or: docker compose up mongodb redis

npm install                          # installs all 3 workspaces (backend, admin-portal, e2e)
npm run dev:backend                  # backend on :3003
npm run dev:portal                   # admin portal on :5173
npm run seed -w backend              # full dev seed (idempotent; uses shared/seed/policies for RBAC)
npm run seed:e2e-users -w backend    # CI-minimal seed: 3 users + DEFAULT_POLICIES (what e2e uses)
npm run typecheck                    # check all workspaces
npm run test -w e2e                  # Playwright suite (needs backend + portal running)
```

## Architecture

```
juvion_v2/
  backend/           Express API (port 3003)
  admin-portal/      React 19 + Vite (port 5173, dev-proxies /api -> :3003)
  e2e/               Playwright system-level suite. Runs against live backend+portal;
                     fixtures + auth helper at e2e/tests/fixtures/, utils at e2e/tests/utils/
  tsconfig.base.json Shared TS config (strict, noUnusedLocals, noUncheckedIndexedAccess)
  docker-compose.yml MongoDB 7, Redis 7, backend, admin-portal
  .sdd/              SDD workflow artifacts (specs/, discovery/) — see "SDD Workflow" below
```

### Backend Modules (M01-M12 + Juvi)

Each module under `backend/src/modules/<name>/` has: `service.ts`, `routes.ts`, `controller.ts`, `validation.ts`, `index.ts`

> **Note**: Models live separately in `backend/src/models/<entity-group>/`, not inside module directories.

| Route prefix    | Module        | Code |
|-----------------|---------------|------|
| /api/admissions | Admissions    | M01  |
| /api/people     | People        | M02  |
| /api/academics  | Academics     | M03  |
| /api/finance    | Finance       | M04  |
| /api/hr         | HR            | M05  |
| /api/welfare    | Welfare       | M06  |
| /api/placement  | Placement     | M07  |
| /api/campus     | Campus Ops    | M08  |
| /api/student-dev| Student Dev   | M09  |
| /api/compliance | Compliance    | M10  |
| /api/governance | Governance    | M11  |
| /api/platform   | Platform      | M12  |
| /api/juvi       | Juvi AI       | -    |
| /api/auth       | Auth          | -    |
| /api/colleges   | Colleges      | -    |

> **Note**: EG09 (Facilities), EG10 (Library), and EG14 (Communication) models are served through M08 Campus Ops under `/api/campus`.

### Frontend Pages

Each module has a hub page (`src/pages/<Module>.tsx`) and sub-pages (`src/pages/<module>/*.tsx`). Services live in `src/services/<module>.ts`.

## Critical Conventions

### Multi-tenancy
- **Every** Mongoose model must have `collegeId: { type: Schema.Types.ObjectId, required: true, index: true }`
- **Every** query must filter by `collegeId` — never query without it
- `authenticate` middleware extracts `collegeId` from JWT or `x-college-id` header
- Dev bypass: when `NODE_ENV=development` and no token, uses `collegeId = '000000000000000000000001'`

### AppError
```typescript
// Constructor: statusCode FIRST, then message
throw new AppError(404, 'Resource not found');  // CORRECT
throw new AppError('Not found', 404);           // WRONG — will not work
```

### Service Layer Pattern
```typescript
export async function getWidget(collegeId: string, id: string) {
  const doc = await Widget.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Widget not found');
  return doc;
}

export async function createWidget(collegeId: string, data: CreateWidgetInput, performedBy: string) {
  const doc = await Widget.create({ ...data, collegeId });
  await createAuditLog({
    collegeId, entityType: 'Widget', entityId: String(doc._id),
    entityName: doc.name, action: 'create', changes: [], performedBy,
  });
  return doc;
}
```

- All CRUD functions take `collegeId` as first param
- CUD functions take `performedBy` as last param and call `createAuditLog()`
- Use `String(doc._id)` to convert ObjectId to string (not `doc._id as string`)
- Prefix unused params with underscore: `_performedBy` if audit not needed

### Controller Pattern
```typescript
export async function listWidgets(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query;
    const result = await widgetService.listWidgets(req.collegeId!, +page, +limit);
    res.json(result);
  } catch (e) { next(e); }
}
```

### Route Pattern
```typescript
router.get('/', authenticate, listWidgets);
router.post('/', authenticate, validate(createWidgetSchema), createWidget);
```

### Pagination
`paginate(Model, filter, page, limit)` returns `{ items, total, page, pages }`

### Validation
Zod schemas in `validation.ts`, applied via `validate(schema)` middleware.

### TypeScript Strictness
- `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noUncheckedIndexedAccess: true`
- Prefix unused params with `_` (e.g., `_performedBy`, `_req`)
- Run `npm run typecheck` to verify zero errors

### RBAC — `authorize()` + `applyAuthScope()`

Two-layer model: middleware decides yes/no, services apply row-level scope.

```typescript
// Route layer — authorize sets req.authScope from the matched policy
router.get('/students', authenticate, authorize('people', 'read'), listStudents);

// Service layer — apply the scope to your query filter
import { applyAuthScope } from '../../shared/rbac/apply-scope';
export async function listStudents(collegeId: string, authScope?: AuthScope) {
  const filter: Record<string, unknown> = { collegeId };
  if (authScope) applyAuthScope(filter, authScope, { departmentField: 'branchId' });
  return paginate(Student, filter, 1, 20);
}
```

- `req.authScope` carries `{ departmentOnly, departmentId, selfOnly, userId, personId, subDomain }`.
- `applyAuthScope(filter, scope, opts)` mutates the filter — pass `{ departmentField: 'branchId' }` or `{ selfField: 'personId' }` to override defaults.
- Personas: `backend/src/shared/rbac/personas.ts` is the source of truth (`F-HOD`, `F-FAC`, `L-PRIN`, `ST-ADM-AC`, etc.). `resolveUserScope` dispatches on **`role`**, NOT `personaType`.
- Policies: `backend/src/shared/rbac/defaults.ts` exports `DEFAULT_POLICIES`. They're upserted via `shared/seed/policies.ts` — **don't** call `Policy.insertMany` directly; that path drifts.
- Env flags: `RBAC_ENFORCE='false'` makes `authorize()` a pass-through (dev mode); `RBAC_NL_ENFORCE='true'` lifts the hard `requireRole(['admin','super_admin'])` gate on the NL endpoint and switches to policy-based access.

### Report Engine — `scopeEligibility` is required

Every `ReportDefinition` in `backend/src/modules/governance/report-registry.ts` declares:

```typescript
scopeEligibility: { departmentOnly: 'supported' | 'admin-only', selfOnly: 'supported' | 'admin-only' }
```

`runReport()` checks this BEFORE invoking the runner — admin-only mismatch with the caller's `authScope` throws `ScopeNotSupportedError`. Forgetting the declaration breaks the type. NL surface (`POST /api/governance/reports/nl-query`) draws from `ALLOWED_REPORTS` in `nl-reports/prompt.ts`; add a code there too when un-stubbing a Phase B runner.

### Fee-Pin Pipeline

Students bind to a `FeeStructureInstance` via 4 wildcardable axes (single contract in `shared/seed/policies` / scope-resolver patterns are similar):

- **Required exact**: `collegeId`, `programmeId`, `academicYearId`, `status: 'active'`.
- **Wildcardable** (null on FSI = match any value on student; specific value = match only that): `branchId`, `category`, `quota`, `yearOfStudy`. Scored exact (2) > wildcard (1) > mismatch (reject) by `scoreAxis()` in `fee-pin-service.ts`.
- **`Course` is NOT a fee axis.** Course (subject-level, e.g., CS201) doesn't participate in fee selection. See `.sdd/discovery/005-fee-mapping-architecture/discovery.md`.

`Student.feePins[]` is an embedded subdoc per `(yearOfStudy)` slot — never mutate it directly; use `fee-pin-service.pinYear() / rePin() / archivePin()`. The `feePins` subdoc lives on `Student.ts`, not as a top-level model.

### Programme transfer (gotcha)

`PATCH /api/people/students/:id` **rejects** any `programmeId` change with a 403:

> `programmeId changes are not allowed via the generic student update; use the programme-transfer endpoint to ensure fee pins are rebound atomically.`

Use `POST /api/finance/students/:id/transfer-programme` instead — payload is `{ newProgrammeId, newBranchId?, newRegulationId?, effectiveYearOfStudy, academicYearId, reason }`. The FE wraps this in `admin-portal/src/components/people/ProgrammeTransferDialog.tsx`.

**Student bulk import honours the same rule.** A re-imported row whose `programmeCode`, `branchCode`, `quota` or `category` differs from the matched student's current value resolves to **Blocked** at preview and is refused with a 409 at commit — those are all fee axes, and applying them directly would strand the pin. Import never calls the transfer service; the operator is sent to the transfer screen. See `backend/src/modules/people/student-import-service.ts`.

### Student bulk import

Two doors onto one engine. `/platform/bulk-imports` serves all five entity types and needs `platform:create` (admin/principal only). `/api/people/students/import/{template,preview,commit}` is a `people`-gated façade over the same `bulk-import-service`, so a Registrar (`ST-REG`) — who owns student records but holds no `platform` access — can actually use it. The FE entry point is the import drawer on `/people/students`.

- Template headers are `fieldKey`, with a trailing `*` on mandatory columns. `normalizeImportHeader` (`bulk-import-service.ts`) strips it on upload. **Two-way contract** — change one side and template files stop importing.
- Schemas live in `backend/src/modules/platform/import-schemas/`. Adding an entity type is one registry entry.
- `ImportSchemaField.validate` is synchronous. Anything needing a DB lookup goes in the optional async `validateRow` hook, which is what lets preview label rows Create / Update / Blocked before anything is written.
- A schema declaring `naturalKeys` gets intra-file duplicate detection; the other four declare none and are unaffected.
- Commit uses compensating rollback, not transactions — the test harness is not a replica set.

## Frontend Conventions

### State Management
- **Server state**: React Query v5 (`@tanstack/react-query`)
- **Auth state**: Zustand store (`src/stores/authStore.ts`) — persists token + collegeId to localStorage
- **HTTP**: Axios with interceptors that attach `Authorization` and `x-college-id` headers; 401 responses clear token and redirect to `/login`

### Form Pages
- Dropdowns for any field referencing another entity (never raw ObjectId text inputs)
- Required dropdown fields get a `+ Manage` link (opens the entity's CRUD page in new tab)
- Shared CSS constants: `inp` for inputs, `lbl` for labels, `manageLink` for manage links
- Modal-based create/edit forms with `react-query` mutations

### Styling
Tailwind CSS with a custom color palette (`primary-*`, `navy`). Icons from `lucide-react`.

## Environment Variables

```
NODE_ENV=development
PORT=3003
MONGODB_URI=mongodb://localhost:27017/juvion_v2  # backend/src/config/db.ts reads this name
MONGO_URI=mongodb://localhost:27017/juvion_v2    # docker-compose / some scripts read this name
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret
DEV_COLLEGE_ID=000000000000000000000001
PAYMENT_WEBHOOK_SECRET=any-non-empty-string-in-production  # app.ts:55 startup guard
RBAC_ENFORCE=true   # 'false' = authorize() is a pass-through (dev mode default behavior)
RBAC_NL_ENFORCE=true  # 'true' = NL endpoint uses authorize() instead of hard requireRole admin gate
VITE_API_URL=http://localhost:3003/api  # baked into the production admin-portal build (vite preview doesn't proxy)
AWS_S3_BUCKET=                  # backend/src/shared/s3/s3-client.ts; unset disables bulk-import source-file archiving (import still succeeds) but photo/faculty-document uploads still 503
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_ENDPOINT=                # set for LocalStack/MinIO; forces path-style addressing
```

> **Gotcha**: `MONGODB_URI` is what the backend actually reads. Earlier CI runs failed because only `MONGO_URI` was set. Set both for safety.

## SDD Workflow

Substantial features go through Spec-Driven Development. Artifacts live under `.sdd/`:

```
.sdd/
  discovery/<NNN-feature>/discovery.md   # Phase 0: map existing code before scoping
  specs/<NNN-feature>/
    spec.md           # Phase 3: user stories + ACs (GATE 1 = no [NEEDS CLARIFICATION])
    gate2-*.md        # Phase 4: parallel validator reports (api-security / data-layer / architecture)
    gate2-resolution.md  # Diff against spec.md
    plan.md           # Phase 5: file-by-file implementation plan
    tasks.md          # Phase 6: TDD-ordered slices (each commit-shaped)
    gate3-audit.md    # Phase 7: pre-impl audit; PASS required to enter Phase 8
```

Gate guardrails:
- **GATE 1**: spec exists, ≥2 ACs per story, zero `[NEEDS CLARIFICATION]` markers.
- **GATE 2**: 0 CRITICAL + 0 HIGH across the three validator reports. Run via `/sdd-team validate` or spawn 3 parallel general-purpose agents.
- **GATE 3**: pre-implementation audit cross-references spec ↔ plan ↔ tasks ↔ live code (file:line refs).

`/sdd-team` (with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) automates GATE 2 + Phase 8. Complexity 1-3 defers to `/sdd` solo; 4-7 standard 3-teammate team; 8-10 enhanced.

## E2E Testing

The `e2e/` workspace runs Playwright against a live backend + portal. CI workflow (`.github/workflows/e2e.yml`) seeds three test users (`e2e_super@juvion.test`, `e2e_principal@juvion.test`, `e2e_registrar@juvion.test` — the last a `staff` / `ST-REG` persona, so `people`-gated surfaces are exercised by a persona that holds no `platform` access) plus all `DEFAULT_POLICIES` via `npm run seed:e2e-users -w backend` before launching the browser. Test fixtures share an `auth-fixture.ts` `loginAs(role)` helper. Render-only tests prefer accessible queries (`getByLabel`, `getByRole`, `getByTestId`) over class names — class churn shouldn't break the suite.

Discipline notes (per the Phase A spec at `.captain/specs/playwright-e2e/spec.md`):
- **Zero retries**. Flake-free is a hard acceptance criterion; retries hide drift.
- **No `page.waitForTimeout`** — only Playwright auto-waiting + `expect.toHaveURL`.
- Mock the network with `page.route` when you need a deterministic response (e.g., `nl-query` mocks in `governance-nl.spec.ts`).

## Key Dependencies

| Backend           | Frontend              |
|-------------------|-----------------------|
| Express 4         | React 19              |
| Mongoose 8        | React Router 7        |
| Zod 3             | React Query 5         |
| BullMQ 5          | Zustand 5             |
| jsonwebtoken 9    | Axios 1.7             |
| ioredis 5         | Tailwind CSS 3        |
| ts-node-dev       | Vite 6                |
