# 010 — Phase 1 plan (file-by-file)

Order is dependency order; each slice leaves typecheck + unit tests green.

| # | Slice | Files |
|---|---|---|
| 1 | Persona collection + seed + CRUD | `models/platform/Persona.ts`, `shared/seed/personas.ts`, `shared/rbac/persona-registry.ts` (load+cache+ancestry), `modules/platform/{service,controller,routes,validation}.ts`, `modules/people/controller.ts` (listPersonas reads collection), `seed.ts`, `scripts/seed-e2e-users.ts`, `__e2e__/setup/seed-base.ts` |
| 2 | Multi-persona engine | `models/User.ts` (personas, tokenVersion), `shared/rbac/{engine,resolve-permissions,types}.ts`, `middleware/{authorize,authenticate}.ts`, `modules/auth/service.ts`, `__e2e__/factories/user.factory.ts`, tests |
| 3 | Sub-domain registry | `shared/rbac/sub-domains.ts` (generated from routes ∪ defaults), `middleware/authorize.ts` typing, `admin-portal/src/config/sub-domains.json` |
| 4 | Fail-closed + by-id scope | `shared/rbac/apply-scope.ts`, `shared/request-context.ts` (scoped flag), `shared/pagination.ts` guard, `shared/rbac/find-one-scoped.ts`, `modules/people/service.ts` by-id functions |
| 5 | Users API | `modules/platform/{user-service,controller,routes,validation}.ts` |
| 6 | Frontend | `stores/authStore.ts`, `hooks/usePermission.ts`, `components/RequirePermission.tsx`, `App.tsx`, `pages/platform/{UsersPage,PersonasPage}.tsx`, `services/{users,personas}.ts`, `pages/Platform.tsx`, `dashboard/registry.tsx`, `pages/Dashboard.tsx`, `layouts/DashboardLayout.tsx` |
| 7 | Scoped stats + seed users + enforcement + route walk | `modules/{people,academics,finance,welfare}/{controller,service}.ts` stats, `seed.ts`, `backend/.env`, `__e2e__/modules/rbac-route-walk.test.ts` |

Deviations from the discovery doc are recorded at the bottom of `tasks.md`.
