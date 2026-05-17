import { describe, it, expect } from 'vitest';
import {
  REPORT_REGISTRY,
  type ReportDefinition,
  type ScopeEligibility,
} from '../report-registry';

/**
 * 004-rbac-nl-queries §3 — every ReportDefinition must declare
 * scopeEligibility. The type system enforces this at compile time;
 * this test catches runtime registry assembly bugs (e.g., if a future
 * author adds a definition without the field).
 */

describe('REPORT_REGISTRY — scopeEligibility declarations', () => {
  it('every report definition declares scopeEligibility', () => {
    for (const def of REPORT_REGISTRY) {
      expect(def.scopeEligibility, `${def.code} is missing scopeEligibility`).toBeDefined();
      expect(def.scopeEligibility.departmentOnly).toMatch(/^(supported|admin-only)$/);
      expect(def.scopeEligibility.selfOnly).toMatch(/^(supported|admin-only)$/);
    }
  });

  it('all Phase B stubs are admin-only on both dimensions (safe-by-default)', () => {
    const stubs = REPORT_REGISTRY.filter((d) => d.implementationStatus === 'phase_b');
    expect(stubs.length).toBeGreaterThan(0); // sanity
    for (const def of stubs) {
      expect(def.scopeEligibility.departmentOnly, `${def.code} (phase_b) should default admin-only`).toBe('admin-only');
      expect(def.scopeEligibility.selfOnly, `${def.code} (phase_b) should default admin-only`).toBe('admin-only');
    }
  });

  it('admissions-funnel is admin-only on both dimensions (Inquiry has no clean departmentId in v1)', () => {
    const def = REPORT_REGISTRY.find((d) => d.code === 'admissions-funnel');
    expect(def).toBeDefined();
    expect(def!.scopeEligibility).toEqual<ScopeEligibility>({ departmentOnly: 'admin-only', selfOnly: 'admin-only' });
  });

  it('lead-source-performance is admin-only on both dimensions (assignedTo legacy strings; counsellor selfOnly deferred to v1.5)', () => {
    const def = REPORT_REGISTRY.find((d) => d.code === 'lead-source-performance');
    expect(def).toBeDefined();
    expect(def!.scopeEligibility).toEqual<ScopeEligibility>({ departmentOnly: 'admin-only', selfOnly: 'admin-only' });
  });

  it('student-roster-snapshot supports departmentOnly (HOD/faculty via Branch lookup)', () => {
    const def = REPORT_REGISTRY.find((d) => d.code === 'student-roster-snapshot');
    expect(def).toBeDefined();
    expect(def!.scopeEligibility.departmentOnly).toBe('supported');
    expect(def!.scopeEligibility.selfOnly).toBe('admin-only');
  });

  it('runners that declare departmentOnly: supported in v1', () => {
    const supported = REPORT_REGISTRY.filter((d: ReportDefinition) => d.scopeEligibility.departmentOnly === 'supported');
    // 004 (Wave 0): student-roster-snapshot
    // Phase B Wave 1: backlog-report (department-aware via Course.departmentId)
    expect(supported.map((d) => d.code).sort()).toEqual(['backlog-report', 'student-roster-snapshot']);
  });

  it('no runner declares selfOnly: supported in v1 (counsellor / student NL deferred)', () => {
    const supported = REPORT_REGISTRY.filter((d: ReportDefinition) => d.scopeEligibility.selfOnly === 'supported');
    expect(supported).toHaveLength(0);
  });

  it('Phase B Wave 1 runners are implemented (not stubs)', () => {
    for (const code of ['backlog-report', 'hostel-occupancy']) {
      const def = REPORT_REGISTRY.find((d) => d.code === code);
      expect(def, `${code} missing from registry`).toBeDefined();
      expect(def!.implementationStatus).toBe('implemented');
    }
  });
});
