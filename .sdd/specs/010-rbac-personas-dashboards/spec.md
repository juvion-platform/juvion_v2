# 010 — RBAC v2: multi-persona, college-editable personas, scoped access, role-aware dashboards

Status: Phase 1 in progress (2026-09-22). Discovery + architecture: `.sdd/discovery/010-rbac-personas-dashboards.md`.
Manager review page: https://claude.ai/artifact/PkwzqLGGu4vduduQ36Mnys

## Goal
A college user sees only the modules, rows, fields and dashboard widgets their designations allow. Colleges configure designations (personas) and policies as data. Enforcement is on in dev with a seeded user per persona.

## User stories (Phase 1)

### S1 — Multi-persona users
As a college admin, I assign more than one persona to a user so an HOD who also teaches gets both sets of access.
- AC1: `User.personas[]` holds ≥1 persona code; `personaType` remains the primary (first) code.
- AC2: `authorize()` allows when any persona allows and **denies when any persona has an explicit deny** for the same module/action.
- AC3: Resulting scope is the least restrictive among allowing personas (departmentOnly only if all say so; subDomain lists unioned).
- AC4: `role` is derived from personas' `defaultRole` (highest tier) whenever a user is created or updated via the Users API.

### S2 — College-editable persona catalog
As a college admin, I add or remove designations for my college.
- AC1: `Persona` collection; system rows (`collegeId: null`) seeded idempotently from `shared/rbac/personas.ts`.
- AC2: `POST/PUT/DELETE /api/platform/personas` for college rows (`platform:*`). System rows: deactivate only.
- AC3: Deleting a persona held by any active user returns 409.
- AC4: Policy persona matching uses the explicit `parentCode` chain, not string prefixes; legacy `X-*` policy rows still match any code in the ancestry.

### S3 — Typed sub-domains and permissions
- AC1: `shared/rbac/sub-domains.ts` lists every sub-domain per module; `authorize()` accepts only registered values (typecheck).
- AC2: `resolvePermissions` emits `module:action` when the allowing policy has no sub-domain, and `module/<sub>:action` for each allowed sub-domain otherwise.
- AC3: `/auth/me` returns `permissions` and `personas`.

### S4 — Revocation and fail-closed scope
- AC1: JWT carries `tv` (token version); `authenticate` rejects tokens whose `tv` is behind the user's current version (Redis-cached).
- AC2: `applyAuthScope` with departmentOnly/selfOnly but no resolvable id yields zero rows.
- AC3: `paginate()` throws when the request carries a narrowing scope and the filter was not passed through `applyAuthScope`.
- AC4: `findOneScoped()` helper; student, faculty, staff, person by-id reads/updates use it. Out-of-scope id → 404.

### S5 — User provisioning
- AC1: `GET/POST/PUT /api/platform/users`, `POST /api/platform/users/:id/reset-password`; `platform:*` gated; college-scoped.
- AC2: Create/update sets personas, derived role, optional `personId`; bumps token version; invalidates scope cache.
- AC3: Platform → Users page: list, create/edit modal with persona multi-select and person link.
- AC4: Platform → Personas page: list, create/edit, deactivate/delete.

### S6 — Role-aware frontend
- AC1: `RequirePermission` guard on every hub route in `App.tsx`; unauthorised URL redirects to `/`.
- AC2: `hasPermission(module, action, subDomain?)` honours sub-domain-qualified strings.
- AC3: Dashboard is a widget registry filtered by permission, ordered by primary persona `primaryModule`.
- AC4: `/stats` for people, academics, finance, welfare apply `req.authScope`.

### S7 — Enforcement on
- AC1: `seed.ts` creates one user per system persona linked to a Faculty/Staff record where applicable.
- AC2: dev `.env` sets `RBAC_ENFORCE=true`.
- AC3: Backend e2e: for each seeded persona, every registered GET route returns 200/403/404, never 500; the resulting matrix is snapshotted.

## Out of scope (later phases)
Assigned scope resolvers (P2), sensitivity classes (P3), students/parents (P4), bulk user import (P2), policy matrix UI (P2).
