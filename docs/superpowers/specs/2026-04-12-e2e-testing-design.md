# E2E Testing Infrastructure — Design Specification

> **Status**: APPROVED | Date: 2026-04-12
> **Scope**: API integration tests + critical workflow scenario tests for all backend modules
> **Dependencies**: mongodb-memory-server, supertest, vitest (existing)

---

## 1. Problem Statement

Juvion v2 has 46 unit tests covering RBAC policy evaluation, but zero integration or E2E tests. The 1,100+ API routes across 13 modules have no automated verification that they accept valid input, reject invalid input, enforce RBAC, or return correct data. Business-critical workflows (admission → enrollment → fees → payment) cross multiple modules and are untested end-to-end.

**Goal**: Build a test infrastructure that validates API endpoints and multi-step business workflows against a real (in-memory) MongoDB, with isolated test data and role-based request helpers.

---

## 2. Test Stack

| Tool | Purpose |
|------|---------|
| Vitest | Test runner (already configured for unit tests) |
| Supertest | HTTP assertions against Express app |
| mongodb-memory-server | In-memory MongoDB for full isolation, zero external deps |
| jsonwebtoken | Generate test auth tokens (already a project dependency) |

No browser-based testing. Frontend is thin CRUD pages + React Query — backend logic chains are the risk.

---

## 3. Directory Structure

```
backend/src/__e2e__/
  setup/
    global-setup.ts          # Start MongoMemoryServer, export URI
    global-teardown.ts       # Stop MongoMemoryServer
    test-app.ts              # Create Express app connected to test DB
    seed-base.ts             # Seed structural base data (college, depts, users)
  factories/
    user.factory.ts          # createTestUser(), createAuthToken()
    student.factory.ts       # createTestStudent() (Person + Student + User)
    finance.factory.ts       # createTestFeeStructure(), createTestFeeLineItem(), createTestPayment()
    academic.factory.ts      # createTestCourseOffering(), createTestEnrollment()
    hr.factory.ts            # createTestEmployee(), createTestLeaveApplication()
    policy.factory.ts        # createTestPolicy()
  helpers/
    request.ts               # Authenticated supertest wrapper
    assertions.ts            # Common assertions (expectPaginated, expect403, etc.)
  workflows/
    01-auth-rbac.test.ts
    02-student-admission.test.ts
    03-fee-payment.test.ts
    04-academic-delivery.test.ts
    05-leave-management.test.ts
    06-rbac-policy-override.test.ts
  modules/
    auth.test.ts
    admissions.test.ts
    people.test.ts
    finance.test.ts
    academics.test.ts
    hr.test.ts
    welfare.test.ts
    platform.test.ts
```

---

## 4. Vitest Configuration

New file: `backend/vitest.e2e.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__e2e__/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    globalSetup: ['src/__e2e__/setup/global-setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } }, // sequential — shared DB state
  },
});
```

**NPM script**: `"test:e2e": "vitest run --config vitest.e2e.config.ts"`

Sequential execution is required because workflow tests depend on shared database state within a suite (e.g., create student in step 1, enroll in step 2).

---

## 5. Global Setup & Teardown

### 5.1 global-setup.ts

Starts a `MongoMemoryServer` instance and exports the URI via an environment variable so test-app.ts can connect.

```
START MongoMemoryServer (MongoDB 7 binary)
SET process.env.MONGO_TEST_URI = server.getUri()
EXPORT teardown function that stops the server
```

### 5.2 global-teardown.ts

Stops the MongoMemoryServer instance.

### 5.3 test-app.ts

Exports a function `getTestApp()` that:
1. Connects Mongoose to `MONGO_TEST_URI`
2. Imports the Express app from `../../app`
3. Returns the app instance for supertest

This runs once per test file (in `beforeAll`). Each test file connects, seeds base data, runs tests, then disconnects.

### 5.4 seed-base.ts

Seeds the structural entities needed by almost every test:

```typescript
export async function seedBase(): Promise<BaseFixtures> {
  // 1. College
  const college = await College.create({
    name: 'JIT Test', code: 'JIT-TEST', status: 'active',
    subscriptionTier: 'premium',
  });
  const collegeId = String(college._id);

  // 2. Departments
  const cse = await Department.create({ collegeId, name: 'CSE', code: 'CSE' });
  const ece = await Department.create({ collegeId, name: 'ECE', code: 'ECE' });

  // 3. Programme + Branches
  const btech = await Programme.create({ collegeId, name: 'B.Tech', code: 'BTECH', duration: 4 });
  const cseBranch = await Branch.create({ collegeId, departmentId: cse._id, programmeId: btech._id, name: 'CSE', code: 'CSE' });
  const eceBranch = await Branch.create({ collegeId, departmentId: ece._id, programmeId: btech._id, name: 'ECE', code: 'ECE' });

  // 4. Academic Year + Semesters
  const ay = await AcademicYear.create({ collegeId, code: '2024-25', label: '2024-25', startDate: '2024-06-01', endDate: '2025-05-31', isCurrent: true });
  const sem1 = await Semester.create({ collegeId, academicYearId: ay._id, number: 1, year: 1, startDate: '2024-06-01', endDate: '2024-11-30', status: 'active' });
  const sem2 = await Semester.create({ collegeId, academicYearId: ay._id, number: 2, year: 1, startDate: '2024-12-01', endDate: '2025-05-31', status: 'upcoming' });

  // 5. Users (with hashed passwords)
  const superAdmin = await createTestUser({ role: 'super_admin', personaType: 'L-SADM', name: 'Super Admin', email: 'super@test.com' });
  const admin = await createTestUser({ collegeId, role: 'admin', personaType: 'L-ADMIN', name: 'College Admin', email: 'admin@test.com' });
  const principal = await createTestUser({ collegeId, role: 'principal', personaType: 'L-PRIN', name: 'Principal', email: 'principal@test.com' });

  // 6. RBAC default policies
  await seedDefaultPolicies();

  return { college, collegeId, cse, ece, btech, cseBranch, eceBranch, ay, sem1, sem2, superAdmin, admin, principal };
}
```

Returns a `BaseFixtures` typed object that test files destructure in `beforeAll`.

---

## 6. Factories

Each factory creates the minimum entity chain needed, returns the created documents.

### 6.1 user.factory.ts

```typescript
createTestUser(opts: {
  collegeId?: string;
  role: string;
  personaType: string;
  name: string;
  email: string;
  password?: string; // default: 'test123'
  personId?: string;
}): Promise<{ user: IUser; token: string }>
```

Creates a User with bcrypt-hashed password. Also generates and returns a JWT token for immediate use in tests.

```typescript
createAuthToken(payload: {
  id: string;
  role: string;
  personaType: string;
  collegeId?: string;
  name?: string;
  email?: string;
}): string
```

Generates a JWT without touching the DB. For tests that need a token for an already-existing user.

### 6.2 student.factory.ts

```typescript
createTestStudent(collegeId: string, opts?: {
  branchId?: string;
  sectionId?: string;
  name?: string;
  email?: string;
  admissionYear?: number;
}): Promise<{ person: IPerson; student: IStudent; user: IUser; token: string }>
```

Creates Person → Student → User in one call. Returns all three documents plus a pre-generated student-role JWT.

### 6.3 finance.factory.ts

```typescript
createTestFeeStructure(collegeId: string, opts?: {
  academicYearId?: string;
  programmeId?: string;
  branchId?: string;
  components?: { name: string; amount: number }[];
}): Promise<IFeeStructure>

createTestFeeLineItem(collegeId: string, opts: {
  studentId: string;
  academicYearId: string;
  component: string;
  amount: number;
  dueDate?: string;
}): Promise<IFeeLineItem>

createTestPayment(collegeId: string, opts: {
  studentId: string;
  amount: number;
  lineItemIds?: string[];
  paymentMode?: string;
}): Promise<IPayment>
```

### 6.4 academic.factory.ts

```typescript
createTestCourse(collegeId: string, opts?: {
  departmentId?: string;
  code?: string;
  name?: string;
  credits?: number;
}): Promise<ICourse>

createTestCourseOffering(collegeId: string, opts: {
  courseId: string;
  semesterId: string;
  sectionId: string;
  facultyId: string;
}): Promise<ICourseOffering>

createTestEnrollment(collegeId: string, opts: {
  studentId: string;
  courseOfferingId: string;
  semesterId: string;
}): Promise<IEnrollment>
```

### 6.5 hr.factory.ts

```typescript
createTestEmployee(collegeId: string, opts?: {
  departmentId?: string;
  designation?: string;
  name?: string;
}): Promise<{ person: IPerson; employee: IEmployee; user: IUser; token: string }>

createTestLeaveType(collegeId: string, opts?: {
  name?: string;
  maxDays?: number;
}): Promise<ILeaveType>
```

### 6.6 policy.factory.ts

```typescript
createTestPolicy(collegeId: string, opts: {
  role: string;
  module: string;
  action: string;
  effect: 'allow' | 'deny';
  personaType?: string;
  scope?: { departmentOnly?: boolean; selfOnly?: boolean; subDomain?: string };
  priority?: number;
}): Promise<IPolicy>
```

---

## 7. Request Helper

File: `backend/src/__e2e__/helpers/request.ts`

Wraps supertest with auth convenience methods:

```typescript
import supertest from 'supertest';
import type { Express } from 'express';

export function createTestApi(app: Express) {
  const agent = supertest(app);

  return {
    // Raw unauthenticated request
    get: (url: string) => agent.get(url),
    post: (url: string) => agent.post(url),
    put: (url: string) => agent.put(url),
    delete: (url: string) => agent.delete(url),

    // Authenticated as a role (generates JWT on the fly)
    as: (token: string) => ({
      get: (url: string) => agent.get(url).set('Authorization', `Bearer ${token}`),
      post: (url: string) => agent.post(url).set('Authorization', `Bearer ${token}`),
      put: (url: string) => agent.put(url).set('Authorization', `Bearer ${token}`),
      delete: (url: string) => agent.delete(url).set('Authorization', `Bearer ${token}`),
    }),
  };
}
```

Usage:
```typescript
const api = createTestApi(app);
await api.get('/api/auth/health').expect(200);
await api.as(adminToken).get('/api/people/students').expect(200);
await api.as(studentToken).get('/api/hr/employees').expect(403);
```

---

## 8. Assertion Helpers

File: `backend/src/__e2e__/helpers/assertions.ts`

```typescript
export function expectPaginated(body: any, opts?: { minItems?: number }) {
  expect(body).toHaveProperty('items');
  expect(body).toHaveProperty('total');
  expect(body).toHaveProperty('page');
  expect(body).toHaveProperty('pages');
  expect(Array.isArray(body.items)).toBe(true);
  if (opts?.minItems !== undefined) {
    expect(body.items.length).toBeGreaterThanOrEqual(opts.minItems);
  }
}

export function expectError(body: any, statusCode: number) {
  expect(body).toHaveProperty('error');
}
```

---

## 9. Module CRUD Tests

Each module test file follows the same pattern:

```typescript
describe('GET /api/<module>/<entity>', () => {
  it('returns paginated list for authorized user', ...);
  it('returns 401 without auth token', ...);
  it('returns 403 for unauthorized role (when RBAC_ENFORCE=true)', ...);
  it('filters by query params', ...);
});

describe('POST /api/<module>/<entity>', () => {
  it('creates entity with valid data', ...);
  it('returns 400 for invalid data (Zod validation)', ...);
  it('returns 409 for duplicate (when applicable)', ...);
});

describe('GET /api/<module>/<entity>/:id', () => {
  it('returns single entity', ...);
  it('returns 404 for non-existent id', ...);
  it('cannot access entity from another college', ...);
});

describe('PUT /api/<module>/<entity>/:id', () => {
  it('updates entity with valid data', ...);
});

describe('DELETE /api/<module>/<entity>/:id', () => {
  it('deletes entity', ...);
  it('returns 404 for non-existent id', ...);
});
```

Module test files cover **one representative entity per module** (not every entity — that would be 200+ models). The chosen entities:

| Module | Entity tested | Why |
|--------|--------------|-----|
| auth | login, me, refresh, health | Core auth flow |
| admissions | Applicant | Central to admission workflow |
| people | Student | Most complex person type |
| finance | Payment | Multi-entity relationships |
| academics | CourseOffering | Links course, section, faculty, semester |
| hr | LeaveApplication | Status transitions |
| welfare | Grievance | Student-linked CRUD |
| platform | Announcement + RBACPolicy | Communication + RBAC management |

---

## 10. Workflow Scenario Tests

### 10.1 Auth & RBAC (01-auth-rbac.test.ts)

```
1. POST /api/auth/login (admin) → 200, body has token + permissions[]
2. POST /api/auth/login (wrong password) → 401
3. GET /api/auth/me (with token) → 200, user profile
4. GET /api/finance/fee-structures (as admin) → 200
5. GET /api/finance/fee-structures (as student, RBAC_ENFORCE=true) → selfOnly scope applied
6. GET /api/hr/employees (as student, RBAC_ENFORCE=true) → 403
7. POST /api/auth/refresh → 200, new token + permissions
8. Rate limit: 11 × POST /api/auth/login (bad password) → 429 on 11th
```

### 10.2 Student Admission (02-student-admission.test.ts)

```
1. POST /api/admissions/inquiries → 201, inquiry created
2. POST /api/admissions/applicants → 201, applicant with status 'applied'
3. POST /api/admissions/exam-scores → 201, score linked to applicant
4. POST /api/admissions/offers → 201, offer for applicant
5. PUT /api/admissions/offers/:id → accept offer, status 'accepted'
6. POST /api/people/students → 201, student record created
7. GET /api/people/students/:id → verify branchId, sectionId, personId linked
8. Verify admission applicant status updated to 'enrolled'
```

### 10.3 Fee → Payment (03-fee-payment.test.ts)

```
1. POST /api/finance/fee-structures → 201 (tuition: 50000, lab: 10000)
2. POST /api/finance/fee-line-items → 201 × 2 (two components for student)
3. GET /api/finance/fee-line-items?studentId=X → 2 items, both 'pending'
4. POST /api/finance/payments → 201 (partial: 30000 against tuition line item)
5. GET /api/finance/fee-line-items/:tuitionId → status 'partial', paidAmount 30000
6. POST /api/finance/payments → 201 (remaining: 20000 against tuition)
7. GET /api/finance/fee-line-items/:tuitionId → status 'paid', paidAmount 50000
8. POST /api/finance/payments → 201 (10000 against lab line item)
9. GET /api/finance/fee-line-items/:labId → status 'paid'
```

### 10.4 Academic Delivery (04-academic-delivery.test.ts)

```
1. POST /api/academics/courses → 201 (Data Structures, 4 credits)
2. Create section + faculty via factories
3. POST /api/academics/course-offerings → 201 (links course + semester + section + faculty)
4. POST /api/academics/enrollments → 201 (student enrolled)
5. GET /api/academics/course-offerings/:id → enrolledCount incremented to 1
6. POST /api/academics/attendance-sessions → 201 (create session)
7. POST /api/academics/attendance-records → 201 (mark student present)
8. POST /api/academics/internal-marks → 201 (enter marks for student)
9. GET /api/academics/enrollments?studentId=X → enrollment linked correctly
```

### 10.5 Leave Management (05-leave-management.test.ts)

```
1. POST /api/hr/leave-types → 201 (Casual Leave, 12 days)
2. Create employee via factory
3. POST /api/hr/leave-balances → 201 (12 days for employee)
4. POST /api/hr/leave-applications → 201 (3 days, status 'pending')
5. PUT /api/hr/leave-applications/:id → approve (status 'approved')
6. GET /api/hr/leave-balances?employeeId=X → balance = 9
7. POST /api/hr/leave-applications → 201 (10 days — exceeds balance)
8. Verify rejection or warning when balance insufficient
```

### 10.6 RBAC Policy Override (06-rbac-policy-override.test.ts)

```
1. Login as student → permissions do NOT include 'hr:read'
2. GET /api/hr/employees as student (RBAC_ENFORCE=true) → 403
3. POST /api/platform/rbac-policies → 201 (allow student read on hr, priority 650)
4. Login as student again → permissions now include 'hr:read'
5. GET /api/hr/employees as student → 200
6. DELETE /api/platform/rbac-policies/:overrideId → 200
7. Login as student → permissions no longer include 'hr:read'
8. DELETE /api/platform/rbac-policies/:systemDefaultId → 403 (protected)
```

---

## 11. Test Isolation Strategy

- **Database**: MongoMemoryServer starts once per vitest run, shared across all test files.
- **Per test file**: `beforeAll` connects Mongoose, seeds base data. `afterAll` drops all collections and disconnects.
- **Per workflow test**: Tests within a `describe` block are **ordered and dependent** (step 1 creates data that step 2 uses). This is intentional for workflow tests — they validate sequential business processes.
- **Per module test**: Tests are independent within each `describe`. Each test creates its own entities via factories.
- **RBAC_ENFORCE**: Set to `'true'` via `process.env.RBAC_ENFORCE = 'true'` in `beforeAll` for RBAC-specific tests. Other tests run with `'false'` (pass-through) to avoid noise.
- **Redis**: Not started for E2E tests. The RBAC cache helpers silently return null on Redis errors (designed for this). Policy evaluation falls through to direct DB queries, which is correct for testing.

---

## 12. NPM Scripts & CI

```json
{
  "test": "vitest run",
  "test:e2e": "vitest run --config vitest.e2e.config.ts",
  "test:all": "vitest run && vitest run --config vitest.e2e.config.ts",
  "test:e2e:watch": "vitest watch --config vitest.e2e.config.ts"
}
```

No CI pipeline changes in this spec. CI setup is a future concern.

---

## 13. Dependencies to Add

```bash
npm install -D supertest @types/supertest mongodb-memory-server
```

- `supertest` — HTTP assertion library for Express
- `@types/supertest` — TypeScript types
- `mongodb-memory-server` — In-memory MongoDB for test isolation

---

## 14. Success Criteria

1. `npm run test:e2e` runs all E2E tests against an in-memory MongoDB with zero external dependencies.
2. 8 module test files cover CRUD operations for 8 representative entities.
3. 6 workflow test files cover multi-step business scenarios end-to-end.
4. All tests pass with `RBAC_ENFORCE=true` for RBAC-specific scenarios.
5. Test factories create minimum viable entity chains (no unnecessary data).
6. Tests are isolated: dropping collections between files prevents cross-contamination.
7. Total E2E run time under 30 seconds.
8. TypeScript strict mode passes with zero errors.
