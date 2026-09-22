# 010 — RBAC v2: multi-persona, college-editable personas, assigned scope, field masks, role-aware dashboards

Phase 0 discovery + proposed architecture. Written 2026-09-16.

## 1. What exists today (verified file:line)

| Layer | Where | State |
|---|---|---|
| Policy model | `backend/src/models/platform/Policy.ts` | `role + personaType(pattern) + module + action → allow/deny`, scope `{departmentOnly, selfOnly, subDomain}`, `collegeId` null = system default. Indexed. |
| Engine | `shared/rbac/engine.ts` | load (Redis 5 min) → filter by module/action/persona wildcard → sort (college-specific > exact persona > exact module > priority) → first match. |
| Middleware | `middleware/authorize.ts` | on ~2,200 routes; 397 pass a `subDomain`. `RBAC_ENFORCE=false` = pass-through (dev default). |
| Row scope | `shared/rbac/apply-scope.ts`, `scope-resolver.ts` | department (via Faculty/Staff.departmentId) and self (via User.personId). Used in 18 service files. **Silently widens** when departmentId is missing. |
| Join scope | `modules/welfare/mentor-scope.ts` | one-off "my mentees" resolver; not generalised. |
| Persona catalog | `shared/rbac/personas.ts` | ~30 codes in code (L1/L2/L3, `parentCode`, `primaryModule`, `defaultRole`). Read-only page at People → Persona Catalog. |
| Defaults | `shared/rbac/defaults.ts` → `shared/seed/policies.ts` | upserted system policies. |
| Permissions to FE | `shared/rbac/resolve-permissions.ts` | flat `module:action` list at login/refresh (not on `/auth/me`). Ignores subDomain → FE cannot tell an exam controller from a full academics user. |
| FE | `stores/authStore.ts` `hasPermission`, `hooks/usePermission.ts`, `layouts/DashboardLayout.tsx:86` nav filter | Only finance + people pages gate buttons. No route guard beyond auth / super-admin. |
| Dashboard | `pages/Dashboard.tsx` | one fixed page, 12 stats queries, none scoped. |
| Users | `models/User.ts` | one `role`, one `personaType` string. No provisioning API or page; only `seed.ts` (2 admins) and the admissions workflow create users. |
| Policy admin | `/api/platform/rbac-policies`, `pages/platform/RbacPolicies.tsx` | exists, invalidates cache. |
| Tests | `shared/rbac/__tests__`, `middleware/__tests__` | engine, scope, cache, authorize covered. |
| Data for join scope | `MentorAssignment.mentorId`, `CourseOffering.facultyId/sectionId`, `FacultySubjectAssignment` | present. |

Conclusion: keep the policy engine as the single source of truth. Extend it; do not add a second roles/permissions model.

## 2. Decisions (from user answers, 2026-09-16)

1. A user can hold **multiple personas**.
2. Persona catalog must be **editable per college** (add / delete), seeded from the code catalog.
3. "My students" for faculty is **college-configurable**: department, mentees, taught sections, or any combination.
4. Students and parents log into the **same portal** later; skip now, but the design must not exclude them.
5. **Field-level** visibility is required.
6. Scale target: hundreds of admin-level users, thousands of students per college.

## 3. Architecture

### 3.1 Identity: `User.personas: string[]`
- Add `personas: [String]` (indexed). Keep `personaType` as the **primary** persona (drives dashboard ordering and defaults). Migration: `personas = [personaType]`.
- JWT payload carries `personas`. `AuthRequest.user.personas`.
- `role` stays single: it is the coarse tier (`admin`, `faculty`, `staff`…) used for the Redis policy cache key. Personas are the fine grain.

### 3.2 Evaluation with many personas
`evaluateAccess(collegeId, role, personas[], module, action)`:
- Evaluate **per persona** exactly as today (first match after sort; explicit deny within that persona wins).
- Across personas: **union of allows**. Result scope = least restrictive among allowing personas (`departmentOnly` only if every allowing persona is department-only; `assigned` sets are unioned; `subDomain` lists unioned; field masks intersected).
- Rationale: an HOD who also teaches should get HOD reach; a deny written for the faculty persona must not silently cripple the HOD persona. A college that wants a global deny writes it with `personaType: null` (matches every persona) at higher priority — engine already supports this.
- `resolvePermissions` becomes the union, and emits sub-domain-qualified strings when a policy carries subDomain: `academics/exams:create` in addition to nothing at module level. FE `hasPermission('academics','create','exams')`.

### 3.3 Persona collection (`models/platform/Persona.ts`)
```
{ collegeId: ObjectId|null, code, label, description, family, parentCode?,
  primaryModule, defaultRole, dashboardWidgets?: string[], isActive, createdBy }
```
- `collegeId: null` rows are seeded from `personas.ts` (idempotent upsert like `seed/policies.ts`). College rows are college-owned.
- Code uniqueness per (collegeId, code). College codes must not collide with system codes; no prefix rule needed, the unique index does it.
- Delete = refuse if any active user holds it (`409`), else hard delete for college rows; system rows can only be deactivated.
- Wildcard policy matching stays string-prefix (`ST-ADM-*`), so a college persona `ST-ADM-JR` inherits ST-ADM policies for free by naming.
- Routes: `/api/platform/personas` CRUD (`platform:*`). `GET /api/people/personas` (existing read) now reads the collection.
- Cache: persona list per college in Redis alongside policies; invalidate on write.

### 3.4 Scope kinds: add `assigned`
Policy scope becomes:
```
scope: { departmentOnly?, selfOnly?, subDomain?, assignedVia?: string[]  // e.g. ['mentees','sections'],
         fields?: { deny?: string[], allow?: string[] } }
```
- `shared/rbac/assignment-resolvers.ts`: a registry `Record<string, (collegeId, personId) => Promise<{ studentIds?: string[]; sectionIds?: string[]; courseOfferingIds?: string[] }>>`. Initial entries: `mentees` (MentorAssignment), `sections` (CourseOffering by facultyId), `courses` (CourseOffering / FacultySubjectAssignment). Adding a kind = one registry entry.
- `resolveUserScope` runs the resolvers named by the matched policies, caches per user 15 min (existing key), invalidated when MentorAssignment / CourseOffering / Faculty change (hook the three services).
- `applyAuthScope(filter, scope, { departmentField, selfField, assignedField: { studentIds: 'studentId', sectionIds: 'sectionId' } })` adds `$in` for each present id set. Department + assigned combine as `$or` (a college that says "department OR mentees" gets both).
- **Fail closed**: if a scope needs `departmentId`/`personId` and it is missing, the filter becomes `{ _id: null }` (zero rows) instead of no-op. This is a behaviour change; the current widening is a bug.
- `mentor-scope.ts` becomes the `mentees` resolver.

### 3.5 Field-level masks
- Declared in policy scope `fields.deny` (dot paths, e.g. `salary`, `bank.accountNo`). Keyed by the route's `module + subDomain`, which 397 routes already declare; masks attach to `req.authScope.fieldMask`.
- **One enforcement point, reads**: `authorize()` wraps `res.json` once per request; the wrapper deep-deletes masked paths from the body (walks objects, arrays, `items[]`). No per-service code. Cost: O(body size); bodies are paginated so bounded.
- **Writes**: same middleware rejects `create/update` bodies that contain a masked path with `403 field not permitted`. Zod validation still runs after.
- Not covered by design: aggregations that fold a masked field into a total (e.g. salary → payroll sum). Treated as a sub-domain decision, not a field one. `ponytail:` per-model projection (`.select`) is the upgrade if body-walking ever shows in profiles.
- FE: `permissions` payload gains `fieldMasks: Record<'module/subDomain', string[]>`; `useFieldHidden(module, subDomain, path)` hides inputs/columns. Server remains the truth.

### 3.6 Frontend gating
- `RequirePermission({module, action?, subDomain?})` wrapper. Used in `App.tsx` for hub routes and inside each hub for sub-pages; replaces every remaining `role ===` check.
- `/auth/me` returns `permissions` + `fieldMasks` so a policy edit takes effect on next hydrate.

### 3.7 Dashboard
- `admin-portal/src/dashboard/registry.ts`: `{ id, module, subDomain?, component, defaultFor: primaryModule[] }` per widget. Existing StatCards become widgets.
- `Dashboard.tsx` = registry filtered by `hasPermission`, ordered: widgets whose module is the primary persona's `primaryModule` first, then the rest; a persona's `dashboardWidgets` (from the Persona doc) overrides order/selection when set. That is the college-configurable "what does an accountant see first".
- Each `/stats` endpoint receives `req.authScope` and applies it, so an HOD sees department numbers, a mentor sees mentee numbers. Student/parent later = same registry with selfOnly widgets.

### 3.8 User provisioning
- `/api/platform/users` CRUD + `pages/platform/UsersPage.tsx`: email, name, role (defaulted from primary persona), personas (multi-select from Persona collection), link to Faculty/Staff/Student via `personId`, active flag, reset password. Invalidate scope cache on change.
- Bulk: add a `user` entity to `modules/platform/import-schemas/` (one registry entry) so a college can upload its staff list with persona codes — reuses preview/commit/rollback.

### 3.9 Enforcement rollout
- `seed.ts`: one user per system persona (`hod@jit…`, `faculty@…`, `accounts@…`, `exam@…`, `warden@…`) linked to real Faculty/Staff records.
- `RBAC_ENFORCE=true` in dev `.env` (dev-bypass user is super_admin; unaffected).
- Playwright: one spec per persona asserting sidebar entries and dashboard widgets; one negative (direct URL → redirect).

## 4. What a real college needs from us on day one (onboarding checklist)
1. Their designation list → personas (system catalog + college additions, §3.3).
2. Org chart → departments already exist; Faculty/Staff must carry `departmentId`.
3. Who-sees-what matrix → policies (existing admin page; ship a CSV/JSON import of policies later if matrices are large).
4. Staff roster with emails and persona codes → bulk user import (§3.8).
5. Mentor and section/course assignments → assigned scope (§3.4).
6. Sensitive fields list → field masks (§3.5).
7. Sign-off environment: log in as each persona, check sidebar + dashboard (§3.9 specs double as the acceptance script).

## 5. Phases (each commit-shaped, spec + tasks to follow)
- **P1 Foundation**: Persona collection + seed + CRUD; `User.personas`; engine union; permissions with subDomain; `/auth/me` permissions; user provisioning API + page; RequirePermission; dashboard registry; scoped `/stats`; fail-closed scope; seeded persona users; enforce on in dev; per-persona e2e.
- **P2 Assigned scope**: resolver registry, `assignedVia` in policy + admin UI, cache invalidation hooks, fold in mentor-scope.
- **P3 Field masks**: policy `fields`, response/request interceptor, FE hook, masks in permissions payload.
- **P4 Students/parents**: L-STU/L-PAR personas activated, self-scoped widgets, parent→child link resolver (`children` assignment kind).

## 6. Risks / open items
- Enabling enforcement will surface pages that were built as super admin and call endpoints the persona cannot read (e.g. dropdown loaders). Expect a fix-up pass; the per-persona e2e is what finds them.
- `redis.keys()` in `cache.ts` invalidation is O(keys). Fine at this scale; `SCAN` if the keyspace grows.
- Multi-persona union means a deny must be written persona-agnostic to be global. Document this on the policy page.

## 7. Drawback mitigations (added 2026-09-16 after review)

| # | Drawback | Fix | Phase |
|---|---|---|---|
| 1 | Row scope is opt-in; a forgotten `applyAuthScope` leaks | (a) `applyAuthScope` tags the filter with a Symbol. `authorize()` stores "this request is scoped" in the existing ALS (`shared/request-context.ts`). `paginate()` (349 call sites) throws `500 scope-not-applied` when the request is scoped and the filter is untagged. Fail loud, not silent. (b) A unit test walks every `routes.ts`, and for each `authorize()` route whose controller handles a list/get, asserts the controller source passes `req.authScope` — covers the 137 raw `find` and 98 `aggregate` sites that bypass paginate. (c) Missing `departmentId`/`personId` on a scoped request → `{ _id: null }`. Note: (a) bends the ALS file's rule "nothing security-relevant"; the ALS carries only a detection flag, tenancy and scope remain explicit params. | P1 |
| 2 | Field masks via response walking miss exports, reports, AI agents | Masks are applied by one function `maskFields(doc, mask)` with three callers: the `res.json` wrapper, the report engine's row emitter (`report-service.ts`), and `runAgentChat` before `buildContext` output reaches `maskPII` (`shared/ai/chat.ts:137`). A persona with any mask on a module gets the AI command bar for that module only after the agent context passes through the same mask. Aggregates: a masked field cannot be summed for that user; the stats service checks `fieldMask` and omits the tile. Entity-keyed rather than route-keyed masks: policies declare `fields` per `module/subDomain`, and the walker applies masks for every sub-domain the user is masked on within that module, so an embedded student in a payment response is masked by people rules too. | P3, but the `maskFields` seam and the AI hook are P1 so nothing is built that bypasses it |
| 3 | Multi-persona union makes per-persona denies surprising | Rule change: **explicit deny wins across personas** (AWS semantics). Union applies to allows only. Simpler to explain: "deny anywhere = deny". Plus `GET /api/platform/rbac-policies/explain?userId&module&action` returning the matched rows per persona and the final verdict, surfaced as an "Explain access" button on the Users page. | P1 |
| 4 | Role and persona overlap | Role is demoted to a derived value: `User.role = max(defaultRole of held personas)` computed on save, not user-editable. Nothing else changes now; role stays in JWT/cache key. Removing it entirely is a later refactor if ever. | P1 |
| 5 | Prefix-name inheritance is fragile | Engine matches persona by explicit `parentCode` chain from the Persona collection (`personaAncestry` already exists in `personas.ts`), not by string prefix. Existing `ST-ADM-*` policies keep working because the seed sets `parentCode` for every L3 row. Colleges pick a parent from a dropdown; the code is free text. | P1 |
| 6 | Sub-domains are free-form strings | `shared/rbac/sub-domains.ts`: `const SUB_DOMAINS = { academics: ['attendance','marks',…], … } as const`; `authorize()` typed against it; the FE imports the same list via a generated JSON. Migration: one script lists the 397 declared strings, diffs against the registry. | P1 |
| 7 | Revocation is slow | `User.tokenVersion` in JWT; `authenticate` compares against a Redis-cached version per user (one GET). Users page edit → bump version + `invalidateUserScope` + policy cache stays. Effective on the next request. | P1 |
| 8 | Enforcement never on; unknown breakage | Seed one user per persona; `RBAC_ENFORCE=true`; Playwright per persona (sidebar, dashboard, one list page, one forbidden URL); plus a backend integration test that logs in as each seeded persona and hits every `GET` route in the app, asserting only 200/403 (never 500) and recording the 403 matrix as a snapshot. The snapshot diff is the review artefact for every later PR. | P1, first slice |
| 9 | Policy table unusable at scale | Matrix view (personas × module/action) on the policy page reading the same rows; per-user "effective permissions" panel on the Users page using the explain endpoint. No new backend model. | P2 |

Per-user exceptions remain unsupported by design; a second persona is the escape hatch.

## 8. Production one-way doors (added 2026-09-16)

Hard to change after a college is live: policy row semantics, the permission vocabulary (module / sub-domain / action / scope kinds), the evaluation contract, the JWT shape. Easy: pages, caches, dashboards, provisioning, explain tools.

Changes to the plan for production safety:

1. **Snapshot, don't cascade.** On college creation, copy system personas and policies into college-owned rows. Runtime evaluation reads college rows only. System defaults become a template plus an "upgrade review" that shows a diff and lets the admin accept per row. A live college never changes behaviour because we edited defaults.
2. **Sensitivity classes, not dot paths.** Models declare `sensitive: 'hr.compensation'` (etc.) on schema paths; classes are a fixed registry (`people.identity`, `hr.compensation`, `finance.bank`, `welfare.medical`, …). Policies grant classes. One declaration drives query projection (`.select`), the response walker, report rows, exports and the AI context. Colleges cannot mistype a path; a new sensitive field is one schema annotation.
3. **Scope on single records too.** `getX/updateX/deleteX` (e.g. `people/service.ts:306,437`) use `findOne({_id, collegeId})` without scope. Add `findOneScoped(Model, id, authScope, opts)` and use it in every by-id service function; the route-walking test hits every `:id` route with a foreign-scope id and expects 404. Without this a faculty member can open any student by URL.
4. **Evaluation contract as golden tests.** Precedence (college > exact persona > module > action > priority), deny-wins across personas, scope union rules — pinned by fixture tests that never change without a documented migration. Vocabulary (sub-domain registry, scope kinds, sensitivity classes) is versioned; renames ship with a policy migration script.
5. **Audit and review.** All persona/policy/user changes audited (already `createAuditLog` in platform service); 403s logged with the matched rows; an "access review" export (user → effective permissions) for NAAC/ISO audits. Optional maker-checker on policy edits later, reusing the finance approval pattern.
6. **Adapter seam.** All checks go through `evaluateAccess` + `resolveUserScope` + `applyAuthScope`/`findOneScoped`. If per-resource sharing ever needs a relationship engine (OpenFGA/SpiceDB), it plugs in behind those three functions without touching routes or services.

Alternatives considered: OpenFGA/SpiceDB (ReBAC) — best model for "my mentees / my sections", rejected now for the second system of record (tuple sync from Mongo) and ops burden for the team size; revisit if per-record sharing or delegation is required. Casbin — replaces ~100 tested lines with a library that still cannot express row scope or field classes; no net gain. OPA/Cedar — policy-as-code is not editable by college admins.
