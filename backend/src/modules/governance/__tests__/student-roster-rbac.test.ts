import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Branch } from '../../../models/academic-structure/Branch';
import { Student } from '../../../models/people/Student';
import { runReport, ADMIN_FULL_SCOPE, ScopeNotSupportedError } from '../report-service';
import type { AuthScope } from '../../../shared/rbac/types';

/**
 * 004-rbac-nl-queries §10.3 + slice D — student-roster-snapshot
 * scope-aware aggregation.
 *
 * Fixture: 2 tenants. Tenant A has 2 departments (A1, A2), each with 2
 * branches. Tenant B has 1 department (B1) with 2 branches. Students
 * planted across all branches.
 *
 * Coverage:
 *   1. Admin (ADMIN_FULL_SCOPE) sees full tenant roster, NOT cross-tenant rows.
 *   2. HOD of dept A1 sees ONLY A1 students.
 *   3. HOD of dept A2 sees ONLY A2 students.
 *   4. HOD of dept B1 sees ONLY B1 students AND zero tenant A rows.
 *   5. HOD with departmentId=undefined → refused via §10.10 scope-unresolved.
 */

const oid = () => new mongoose.Types.ObjectId();

describe('student-roster-snapshot — RBAC scope (slice D)', () => {
  let collegeA: mongoose.Types.ObjectId;
  let collegeB: mongoose.Types.ObjectId;
  let deptA1: mongoose.Types.ObjectId;
  let deptA2: mongoose.Types.ObjectId;
  let deptB1: mongoose.Types.ObjectId;
  let branchesA1: mongoose.Types.ObjectId[];
  let branchesA2: mongoose.Types.ObjectId[];
  let branchesB1: mongoose.Types.ObjectId[];

  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
  });

  async function seedFixture() {
    collegeA = oid();
    collegeB = oid();
    deptA1 = oid();
    deptA2 = oid();
    deptB1 = oid();

    // Tenant A — 2 departments, 2 branches each. Use unique codes so
    // the {collegeId, code} unique index isn't tripped.
    const a1b1 = await Branch.create({ collegeId: collegeA, departmentId: deptA1, code: 'A1-CSE', name: 'A1 CSE', programmeId: oid(), intake: 60 });
    const a1b2 = await Branch.create({ collegeId: collegeA, departmentId: deptA1, code: 'A1-IT',  name: 'A1 IT',  programmeId: oid(), intake: 60 });
    const a2b1 = await Branch.create({ collegeId: collegeA, departmentId: deptA2, code: 'A2-ECE', name: 'A2 ECE', programmeId: oid(), intake: 60 });
    const a2b2 = await Branch.create({ collegeId: collegeA, departmentId: deptA2, code: 'A2-EEE', name: 'A2 EEE', programmeId: oid(), intake: 60 });
    branchesA1 = [a1b1._id as mongoose.Types.ObjectId, a1b2._id as mongoose.Types.ObjectId];
    branchesA2 = [a2b1._id as mongoose.Types.ObjectId, a2b2._id as mongoose.Types.ObjectId];

    // Tenant B — 1 department, 2 branches. Use distinct codes per tenant
    // (unique index is {collegeId, code} so cross-tenant clashes are OK).
    const b1b1 = await Branch.create({ collegeId: collegeB, departmentId: deptB1, code: 'B1-CSE', name: 'B1 CSE', programmeId: oid(), intake: 60 });
    const b1b2 = await Branch.create({ collegeId: collegeB, departmentId: deptB1, code: 'B1-IT',  name: 'B1 IT',  programmeId: oid(), intake: 60 });
    branchesB1 = [b1b1._id as mongoose.Types.ObjectId, b1b2._id as mongoose.Types.ObjectId];

    // Students: 5 per branch (40 total in tenant A, 10 in tenant B). Each
    // student is active for the default scope filter.
    const studentDocs: Array<Record<string, unknown>> = [];
    const seedBranch = (collegeId: mongoose.Types.ObjectId, branchId: mongoose.Types.ObjectId, n: number) => {
      for (let i = 0; i < n; i++) {
        studentDocs.push({
          collegeId,
          personId: oid(),
          admissionYear: 2025,
          programmeId: oid(),
          branchId,
          // Unique rollNumber per student — the {collegeId, rollNumber}
          // unique-sparse index treats missing rollNumber as null and
          // collides at scale (same flake we fixed in promote-students-pin).
          rollNumber: `R-${String(branchId).slice(-6)}-${i}`,
          quota: 'convener',
          category: 'OC',
          status: 'active',
        });
      }
    };
    for (const b of branchesA1) seedBranch(collegeA, b, 10);
    for (const b of branchesA2) seedBranch(collegeA, b, 10);
    for (const b of branchesB1) seedBranch(collegeB, b, 5);
    await Student.insertMany(studentDocs);
  }

  it('admin (ADMIN_FULL_SCOPE) sees full tenant-A roster, none of tenant B', async () => {
    await seedFixture();
    const run = await runReport(String(collegeA), 'student-roster-snapshot', { status: 'active' }, 'admin', ADMIN_FULL_SCOPE);
    expect(run.status).toBe('success');
    const total = (run.result as Array<{ count: number }>).reduce((s, r) => s + r.count, 0);
    expect(total).toBe(40); // 4 branches × 10 in tenant A; 0 from tenant B
  });

  it('HOD of dept A1 sees ONLY A1 students (departmentOnly via Branch lookup)', async () => {
    await seedFixture();
    const hodA1Scope: AuthScope = {
      departmentOnly: true,
      selfOnly: false,
      departmentId: String(deptA1),
      userId: 'hod-a1-user',
      resolvedPermissions: [],
    };
    const run = await runReport(String(collegeA), 'student-roster-snapshot', { status: 'active' }, 'hod-a1', hodA1Scope);
    expect(run.status).toBe('success');
    const rows = run.result as Array<{ branch: string; count: number }>;
    // Only the 2 A1 branches should appear in rows.
    const branchIdsInResult = new Set(rows.map((r) => r.branch));
    expect(branchIdsInResult.size).toBe(2);
    for (const bid of branchesA1) expect(branchIdsInResult.has(String(bid))).toBe(true);
    for (const bid of branchesA2) expect(branchIdsInResult.has(String(bid))).toBe(false);
    const total = rows.reduce((s, r) => s + r.count, 0);
    expect(total).toBe(20); // 2 A1 branches × 10
  });

  it('HOD of dept A2 sees ONLY A2 students (not A1, not tenant B)', async () => {
    await seedFixture();
    const hodA2Scope: AuthScope = {
      departmentOnly: true,
      selfOnly: false,
      departmentId: String(deptA2),
      userId: 'hod-a2-user',
      resolvedPermissions: [],
    };
    const run = await runReport(String(collegeA), 'student-roster-snapshot', { status: 'active' }, 'hod-a2', hodA2Scope);
    const rows = run.result as Array<{ branch: string; count: number }>;
    const branchIdsInResult = new Set(rows.map((r) => r.branch));
    expect(branchIdsInResult.size).toBe(2);
    for (const bid of branchesA2) expect(branchIdsInResult.has(String(bid))).toBe(true);
    for (const bid of branchesA1) expect(branchIdsInResult.has(String(bid))).toBe(false);
    const total = rows.reduce((s, r) => s + r.count, 0);
    expect(total).toBe(20);
  });

  it('HOD of dept B1 sees ONLY B1 students — cross-tenant rows are excluded', async () => {
    await seedFixture();
    const hodB1Scope: AuthScope = {
      departmentOnly: true,
      selfOnly: false,
      departmentId: String(deptB1),
      userId: 'hod-b1-user',
      resolvedPermissions: [],
    };
    const run = await runReport(String(collegeB), 'student-roster-snapshot', { status: 'active' }, 'hod-b1', hodB1Scope);
    const rows = run.result as Array<{ branch: string; count: number }>;
    const total = rows.reduce((s, r) => s + r.count, 0);
    expect(total).toBe(10); // 2 B1 branches × 5
    // None of tenant A's branches should appear.
    const allTenantABranches = new Set([...branchesA1, ...branchesA2].map(String));
    for (const r of rows) expect(allTenantABranches.has(r.branch)).toBe(false);
  });

  it('cross-tenant: HOD-A1 querying tenant B college (mismatched scope dept→tenant) returns ZERO rows', async () => {
    await seedFixture();
    // If an attacker forged a request switching collegeId to tenant B but
    // kept their tenant-A authScope.departmentId, the Branch.find filters
    // by collegeId=B AND departmentId=<tenant A's dept>, which finds zero
    // matching branches → match.branchId = { $in: [] } → zero rows. The
    // multi-tenancy collegeId filter is the load-bearing defense.
    const hodA1Scope: AuthScope = {
      departmentOnly: true,
      selfOnly: false,
      departmentId: String(deptA1),
      userId: 'attacker',
      resolvedPermissions: [],
    };
    const run = await runReport(String(collegeB), 'student-roster-snapshot', { status: 'active' }, 'attacker', hodA1Scope);
    expect(run.status).toBe('success');
    const rows = (run.result || []) as Array<unknown>;
    expect(rows).toHaveLength(0);
  });

  it('HOD with departmentId:undefined → refused via §10.10 scope-unresolved', async () => {
    await seedFixture();
    const brokenHodScope: AuthScope = {
      departmentOnly: true,
      selfOnly: false,
      departmentId: undefined,
      userId: 'broken-hod',
      resolvedPermissions: [],
    };
    await expect(
      runReport(String(collegeA), 'student-roster-snapshot', { status: 'active' }, 'broken-hod', brokenHodScope),
    ).rejects.toBeInstanceOf(ScopeNotSupportedError);
    try {
      await runReport(String(collegeA), 'student-roster-snapshot', { status: 'active' }, 'broken-hod', brokenHodScope);
    } catch (err) {
      expect((err as ScopeNotSupportedError).kind).toBe('scope-unresolved');
      expect((err as ScopeNotSupportedError).dimension).toBe('department');
    }
  });
});
