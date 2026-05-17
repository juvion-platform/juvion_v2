import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { ReportRun } from '../../../models/governance/ReportRun';
import { runReport, ScopeNotSupportedError, ADMIN_FULL_SCOPE } from '../report-service';
import type { AuthScope } from '../../../shared/rbac/types';

/**
 * 004-rbac-nl-queries §10.10 — `runReport` eligibility gate.
 *
 * The gate fires BEFORE any side effects (ReportRun.create, def.run,
 * audit log) and refuses when:
 *   1. `authScope.departmentOnly` is set AND `def.scopeEligibility.departmentOnly === 'admin-only'`
 *   2. `authScope.selfOnly` is set AND `def.scopeEligibility.selfOnly === 'admin-only'`
 *   3. `authScope.departmentOnly` is set AND `authScope.departmentId` is undefined (scope-unresolved)
 *   4. `authScope.selfOnly` is set AND `authScope.userId` is undefined (scope-unresolved)
 *
 * Admin path (sentinel `ADMIN_FULL_SCOPE` with both flags false) bypasses
 * the gate entirely — runner is invoked unchanged.
 */

const oid = () => new mongoose.Types.ObjectId().toString();

describe('runReport — §10.10 eligibility gate', () => {
  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
  });

  describe('admin-only mismatch — refuse pre-side-effects', () => {
    it('refuses HOD asking admissions-funnel (departmentOnly admin-only)', async () => {
      const collegeId = oid();
      const hodScope: AuthScope = {
        departmentOnly: true,
        selfOnly: false,
        departmentId: oid(),
        userId: oid(),
        resolvedPermissions: [],
      };

      await expect(
        runReport(collegeId, 'admissions-funnel', { from: new Date(), to: new Date() }, 'hod-user', hodScope),
      ).rejects.toBeInstanceOf(ScopeNotSupportedError);

      // Pre-side-effect proof: no ReportRun doc was created.
      const count = await ReportRun.countDocuments({ collegeId });
      expect(count).toBe(0);
    });

    it('refuses counsellor asking student-roster-snapshot (selfOnly admin-only)', async () => {
      const collegeId = oid();
      const counsellorScope: AuthScope = {
        departmentOnly: false,
        selfOnly: true,
        userId: oid(),
        personId: oid(),
        resolvedPermissions: [],
      };

      try {
        await runReport(collegeId, 'student-roster-snapshot', {}, 'counsellor-user', counsellorScope);
        expect.fail('expected ScopeNotSupportedError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ScopeNotSupportedError);
        const e = err as ScopeNotSupportedError;
        expect(e.reportCode).toBe('student-roster-snapshot');
        expect(e.dimension).toBe('self');
        expect(e.kind).toBe('role-not-eligible');
      }
      const count = await ReportRun.countDocuments({ collegeId });
      expect(count).toBe(0);
    });
  });

  describe('scope-unresolved — refuse pre-side-effects', () => {
    it('refuses HOD with departmentOnly:true but departmentId:undefined', async () => {
      const collegeId = oid();
      const brokenHodScope: AuthScope = {
        departmentOnly: true,
        selfOnly: false,
        departmentId: undefined,
        userId: oid(),
        resolvedPermissions: [],
      };

      try {
        await runReport(collegeId, 'student-roster-snapshot', {}, 'hod-user', brokenHodScope);
        expect.fail('expected ScopeNotSupportedError');
      } catch (err) {
        expect(err).toBeInstanceOf(ScopeNotSupportedError);
        const e = err as ScopeNotSupportedError;
        expect(e.reportCode).toBe('student-roster-snapshot');
        expect(e.dimension).toBe('department');
        expect(e.kind).toBe('scope-unresolved');
      }
      const count = await ReportRun.countDocuments({ collegeId });
      expect(count).toBe(0);
    });

    it('refuses selfOnly with userId:undefined', async () => {
      const collegeId = oid();
      const brokenScope: AuthScope = {
        departmentOnly: false,
        selfOnly: true,
        userId: undefined as unknown as string,
        resolvedPermissions: [],
      };

      try {
        // Note: admissions-funnel is admin-only on selfOnly so the admin-only check
        // would fire FIRST in our gate order. Use a hypothetical 'supported' runner
        // to test this branch by inverting: we still want to assert the gate's
        // scope-unresolved check exists even when admin-only check passes. Since v1
        // has no selfOnly-supported runner, we synthesize the test by checking that
        // admin-only mismatch is still detected (priority order is admin-only first).
        await runReport(collegeId, 'admissions-funnel', { from: new Date(), to: new Date() }, 'user', brokenScope);
        expect.fail('expected ScopeNotSupportedError');
      } catch (err) {
        expect(err).toBeInstanceOf(ScopeNotSupportedError);
        // Admin-only check fires first (deterministic order); kind is 'role-not-eligible' here.
        // The pure 'scope-unresolved' for selfOnly is covered when a 'supported' selfOnly runner exists.
      }
    });
  });

  describe('admin path — sentinel scope bypasses gate', () => {
    it('admin (ADMIN_FULL_SCOPE) invokes runner unchanged for admin-only report', async () => {
      const collegeId = oid();
      // admissions-funnel runs against empty collections — no rows but a ReportRun gets created.
      const doc = await runReport(
        collegeId,
        'admissions-funnel',
        { from: new Date('2024-01-01'), to: new Date('2024-12-31') },
        'admin',
        ADMIN_FULL_SCOPE,
      );
      expect(doc).toBeDefined();
      expect(doc.status).toBe('success');
      const count = await ReportRun.countDocuments({ collegeId });
      expect(count).toBe(1);
    });

    it('admin (ADMIN_FULL_SCOPE) invokes runner unchanged for departmentOnly-supported report', async () => {
      const collegeId = oid();
      const doc = await runReport(
        collegeId,
        'student-roster-snapshot',
        { status: 'active' },
        'admin',
        ADMIN_FULL_SCOPE,
      );
      expect(doc).toBeDefined();
      expect(doc.status).toBe('success');
    });
  });

  describe('non-admin allowed — runner invoked with scope', () => {
    it('HOD with valid departmentId allowed for student-roster-snapshot (gate passes)', async () => {
      const collegeId = oid();
      const hodScope: AuthScope = {
        departmentOnly: true,
        selfOnly: false,
        departmentId: oid(),
        userId: oid(),
        resolvedPermissions: [],
      };

      const doc = await runReport(collegeId, 'student-roster-snapshot', { status: 'active' }, 'hod-user', hodScope);
      expect(doc).toBeDefined();
      // The runner runs against an empty fixture so rows is empty, but the run succeeds
      // (the Branch lookup yields no branches, so the $in clause matches nothing — correct).
      expect(doc.status).toBe('success');
    });
  });
});
