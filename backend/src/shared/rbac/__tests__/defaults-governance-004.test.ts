import { describe, it, expect } from 'vitest';
import { DEFAULT_POLICIES } from '../defaults';
import { filterPolicies, sortPolicies } from '../engine';
import type { PolicyDoc } from '../types';

/**
 * 004-rbac-nl-queries §10.9 — policy seed for NL governance unlock.
 *
 * Three new policy rows added to DEFAULT_POLICIES:
 *   1. hod/governance/read — allow + departmentOnly, priority 800
 *   2. faculty/governance/read — allow + departmentOnly, priority 700
 *   3. staff/governance/read — deny, priority 700 (overrides the base
 *      staff fallback at priority 600 that would otherwise grant unscoped
 *      module='*' action='read' to every staff persona)
 *
 * Without (3), flipping RBAC_NL_ENFORCE='true' would expose unscoped
 * governance data to every staff persona via the base fallback at line 53.
 */

const POLICIES = DEFAULT_POLICIES as PolicyDoc[];

function forRole(role: string): PolicyDoc[] {
  return POLICIES.filter((p) => p.role === role || p.role === '*');
}

describe('defaults.ts — 004 §10.9 governance NL unlock seed', () => {
  describe('hod/governance/read', () => {
    it('is declared with allow + departmentOnly at priority 800', () => {
      const match = POLICIES.find(
        (p) =>
          p.role === 'hod' &&
          p.module === 'governance' &&
          p.action === 'read' &&
          p.effect === 'allow',
      );
      expect(match, 'hod/governance/read allow policy must exist').toBeDefined();
      expect(match?.scope?.departmentOnly).toBe(true);
      expect(match?.priority).toBe(800);
      expect(match?.isActive).toBe(true);
      expect(match?.description).toBeTruthy();
    });

    it('behaviorally: evaluateAccess-shape resolves HOD governance read to allow + departmentOnly', () => {
      const hodPolicies = forRole('hod');
      const filtered = filterPolicies(hodPolicies, 'governance', 'read', 'F-HOD');
      const sorted = sortPolicies(filtered);
      const top = sorted[0];
      expect(top).toBeDefined();
      expect(top!.role).toBe('hod');
      expect(top!.effect).toBe('allow');
      expect(top!.scope?.departmentOnly).toBe(true);
    });
  });

  describe('faculty/governance/read', () => {
    it('is declared with allow + departmentOnly at priority 700', () => {
      const match = POLICIES.find(
        (p) =>
          p.role === 'faculty' &&
          p.module === 'governance' &&
          p.action === 'read' &&
          p.effect === 'allow',
      );
      expect(match, 'faculty/governance/read allow policy must exist').toBeDefined();
      expect(match?.scope?.departmentOnly).toBe(true);
      expect(match?.priority).toBe(700);
      expect(match?.isActive).toBe(true);
    });

    it('behaviorally: faculty governance read resolves to allow + departmentOnly', () => {
      const facultyPolicies = forRole('faculty');
      const filtered = filterPolicies(facultyPolicies, 'governance', 'read', 'F-FAC');
      const sorted = sortPolicies(filtered);
      const top = sorted[0];
      expect(top).toBeDefined();
      expect(top!.role).toBe('faculty');
      expect(top!.effect).toBe('allow');
      expect(top!.scope?.departmentOnly).toBe(true);
    });
  });

  describe('staff/governance/read — explicit deny overrides base fallback', () => {
    it('is declared with deny at priority 700', () => {
      const match = POLICIES.find(
        (p) =>
          p.role === 'staff' &&
          p.module === 'governance' &&
          p.action === 'read' &&
          p.effect === 'deny' &&
          p.personaType === undefined,
      );
      expect(match, 'staff/governance/read deny policy must exist').toBeDefined();
      expect(match?.priority).toBe(700);
      expect(match?.isActive).toBe(true);
    });

    it('behaviorally: ST-WARDEN governance:read resolves to deny (not the base 600-priority allow)', () => {
      const staffPolicies = forRole('staff');
      const filtered = filterPolicies(staffPolicies, 'governance', 'read', 'ST-WARDEN');
      const sorted = sortPolicies(filtered);
      const top = sorted[0];
      expect(top, 'top policy must exist (deny is still a policy)').toBeDefined();
      expect(top!.effect).toBe('deny');
    });

    it('behaviorally: ST-ADM-AC (counsellor) governance:read resolves to deny', () => {
      const staffPolicies = forRole('staff');
      const filtered = filterPolicies(staffPolicies, 'governance', 'read', 'ST-ADM-AC');
      const sorted = sortPolicies(filtered);
      const top = sorted[0];
      expect(top).toBeDefined();
      expect(top!.effect).toBe('deny');
    });

    it('behaviorally: ST-TPO governance:read resolves to deny', () => {
      const staffPolicies = forRole('staff');
      const filtered = filterPolicies(staffPolicies, 'governance', 'read', 'ST-TPO');
      const sorted = sortPolicies(filtered);
      const top = sorted[0];
      expect(top).toBeDefined();
      expect(top!.effect).toBe('deny');
    });

    it('preserves non-governance staff fallback (warden welfare still allowed)', () => {
      const staffPolicies = forRole('staff');
      const filtered = filterPolicies(staffPolicies, 'welfare', 'read', 'ST-WARDEN');
      const sorted = sortPolicies(filtered);
      const top = sorted[0];
      expect(top).toBeDefined();
      expect(top!.effect).toBe('allow');
    });
  });

  describe('regression: unrelated policies intact', () => {
    it('still grants principal full governance access', () => {
      const match = POLICIES.find(
        (p) =>
          p.role === 'principal' &&
          p.module === 'governance' &&
          p.action === '*' &&
          p.effect === 'allow',
      );
      expect(match).toBeDefined();
    });

    it('still grants super_admin wildcard access', () => {
      const match = POLICIES.find(
        (p) =>
          p.role === 'super_admin' &&
          p.module === '*' &&
          p.action === '*' &&
          p.effect === 'allow',
      );
      expect(match).toBeDefined();
    });

    it('still grants admin wildcard access', () => {
      const match = POLICIES.find(
        (p) =>
          p.role === 'admin' &&
          p.module === '*' &&
          p.action === '*' &&
          p.effect === 'allow',
      );
      expect(match).toBeDefined();
    });

    it('preserves the staff base fallback for non-governance reads', () => {
      const match = POLICIES.find(
        (p) =>
          p.role === 'staff' &&
          p.module === '*' &&
          p.action === 'read' &&
          p.effect === 'allow' &&
          p.priority === 600,
      );
      expect(match, 'staff base fallback at priority 600 must remain').toBeDefined();
    });
  });
});
