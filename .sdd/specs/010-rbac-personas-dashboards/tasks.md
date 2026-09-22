# 010 — Phase 1 tasks

- [x] T1 Persona model, seed, registry (ancestry + cache), platform CRUD, people listPersonas from collection
- [x] T2 User.personas + tokenVersion; engine multi-persona (deny wins, scope merge, ancestry match); resolvePermissions w/ sub-domain; authorize + authenticate (tv); auth service (login/me/refresh)
- [x] T3 Sub-domain registry + typed authorize + FE JSON (+ policy validation refuses unknown sub-domains)
- [x] T4 Fail-closed applyAuthScope; paginate guard; findOneScoped in people by-id; scopeViaMembers/scopeViaStudents; ObjectId casting for aggregates
- [x] T5 Users API (list/get/create/update/reset-password/explain)
- [x] T6 FE: authStore/hasPermission(sub), RequirePermission, App routes, Users + Personas pages, dashboard registry
- [x] T7 Scoped people stats; seed persona users; RBAC_ENFORCE=true; route-walk e2e (794 GET routes × 4 personas, 0×500, snapshot)

## Deviations from the discovery doc
- Persona snapshot-per-college is implemented (T1); **policy** snapshot-per-college is deferred to P2 — policies still cascade system → college at runtime.
- Scoped `/stats` done for people only; academics/finance/welfare stats are college-wide counts with no clean department axis — left as-is, revisit with P2 assigned scope.
- Row scope on by-id reads/updates/deletes applied to Person/Student/Faculty/Staff (the entities with a department or person axis). Other by-id functions remain college-scoped.
- 28 list functions found by the route walk were classified: student-linked → `scopeViaStudents`, employee/faculty-linked → `scopeViaMembers`, college-wide config → `scopeNotApplicable` (grep for it to review the calls).
- Redis client now `enableOfflineQueue: false`, `connectTimeout: 2000`: with Redis down every cache read used to block on reconnect back-off; now callers fall through to Mongo immediately.
- Pre-existing bugs fixed because the walk tripped on them: `$toObjectId` used as a query operator (campus labs/facilities/mess), `/labs/:id` shadowing two static routes, event calendar and attendance threshold not validating params, CommonJS `require` of the import registry.
- Pre-existing e2e failures NOT caused by this work (fail identically on the base commit): fee-alerts demo-seed KPIs + HOD scope, fee-configuration pin-audit coverage.
- Bulk user import (`user` entity type) and the policy matrix UI move to P2 as planned.

# Phase 2 tasks (2026-09-22)

- [x] P2-1 Assigned scope: `shared/rbac/assignment-resolvers.ts` (mentees / sections / courses, cached per person, invalidated on mentor-assignment and course-offering writes); policy `scope.assignedVia`; `applyAuthScope` ORs department / self / assigned and never clobbers caller keys; faculty default `people:read` now via mentees + sections
- [x] P2-2 Policy snapshot per college: `snapshotPoliciesForCollege`, engine evaluates college rows only once snapshotted (legacy cascade otherwise), defaults review (`GET /rbac-policies/defaults-diff`, `POST /apply-defaults`, `POST /snapshot`), seeds + college creation snapshot
- [x] P2-3 Chain-aware specificity: a sub-persona's own row outranks an inherited parent row; explicit denies added for ST-ADM-TC delete/approve
- [x] P2-4 Policy matrix endpoint + Matrix / Defaults review tabs on the RBAC Policies page; "Assigned via" in the policy form
- [x] P2-5 Bulk user import (`user` entity type: email, name, personas, password, employeeCode/rollNumber, isActive; temp password when blank)
- [x] P2-6 Persona `dashboardWidgets` pin field on the Personas page

## Phase 2 deviations
- Single-policy semantics changed: a row carrying both `departmentOnly` and `selfOnly` now means department OR self (previously AND). No shipped default used both.
- Sub-persona inheritance now flows parent allows down through `parentCode`; the old prefix wildcard rows (`X-*`) still match. Defaults that relied on "no inheritance" got explicit denies (tele-counsellor delete/approve).
- Bulk import commits users with `callerRole: 'admin'` (the import context carries no role), so a super-admin persona cannot be granted through a CSV.

# Phase 3 tasks (2026-09-22)

- [x] P3-1 `shared/rbac/sensitivity.ts`: classes (`people.identity`, `hr.compensation`, `welfare.medical`, `finance.bank`), `sensitive:` annotation on schema paths (Person.aadhaar, Inquiry.aadhaarNumber, Payroll/PayStructure pay fields, Recruitment.salary, HealthRecord bloodGroup/allergies, MedicalVisit.diagnosis, DietaryPreference.allergies), one walker `maskFields` + `findHiddenKey`
- [x] P3-2 Policy `scope.sensitivity` (undefined = all, [] = none, list = only those); merge: any unrestricted allow lifts the mask, else union; defaults: HOD hr read and the staff read-all fallback grant no classes
- [x] P3-3 Enforcement in `authorize()`: masks every JSON response on the request, refuses non-read bodies carrying a hidden key (403 naming the field); same mask on report rows (`report-service`) and on the AI context before `maskPII` (`shared/ai/chat.ts`, both agents pass `hiddenClasses`)
- [x] P3-4 Browser: login/refresh/me return `sensitivity: { module: string[] | null }`; `canSeeClass` + `useCanSeeClass`; Aadhaar, pay and medical fields hidden in forms/tables/details and omitted from payloads; "Sensitive fields" tri-state on the policy form; scope labels include it
- [x] P3-5 Tests: unit (walker, merge), e2e `rbac-sensitivity.test.ts` (read mask, list mask, write refusal, login map), route-walk snapshot refreshed

## Phase 3 deviations
- Masking is by leaf key name across all models, not per model (`ponytail:` note in sensitivity.ts). A non-sensitive field sharing a name with a sensitive one is hidden too. None of the annotated names collide today.
- `finance.bank` is declared but no schema carries a bank field yet (VendorPayment.bankReference is a reference, not an account number).
- Aggregates that fold a masked field into a total (payroll sums) are not masked; treat those endpoints as `hr` sub-domain decisions.
- Non-incremental `tsc` on this backend takes ~65 s and >2 GB heap on the base commit too; the default `npm run typecheck` relies on the incremental cache and can OOM after a large diff (`NODE_OPTIONS=--max-old-space-size=4096` fixes it).
