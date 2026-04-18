import { describe, it, expect } from 'vitest';
import { DEFAULT_POLICIES } from '../defaults';
import { filterPolicies, sortPolicies } from '../engine';
import type { PolicyDoc } from '../types';

/**
 * T11 (optional-hostel-transport-allotment): defaults.ts extensions.
 *
 * Three new policy groups are required:
 *   1. ST-TRANSPORT-OFFICER persona on module=campus with subDomain=transport
 *   2. ST-WARDEN persona on module=campus with subDomain=hostel
 *      (in addition to the existing welfare-module policy)
 *   3. Student role on module=campus:
 *      - read (selfOnly)
 *      - update (selfOnly, subDomain=hostel-allocation,transport-allocation)
 *
 * These must coexist with existing defaults without breaking them.
 */

// Treat DEFAULT_POLICIES as PolicyDoc[] for engine-level matchers.
const POLICIES = DEFAULT_POLICIES as PolicyDoc[];

/**
 * Mimic `loadPolicies`' DB-side role filter: only policies matching the user's
 * role (or the `*` wildcard role) are passed to `filterPolicies`/`sortPolicies`.
 * Tests that exercise the full decision pipeline must pre-filter by role,
 * otherwise cross-role policies (super_admin, principal, etc.) bleed in.
 */
function forRole(role: string): PolicyDoc[] {
  return POLICIES.filter((p) => p.role === role || p.role === '*');
}

describe('defaults.ts — ST-TRANSPORT-OFFICER persona', () => {
  it('includes a campus-module allow policy with subDomain=transport', () => {
    const match = POLICIES.find(
      (p) =>
        p.role === 'staff' &&
        p.personaType === 'ST-TRANSPORT-OFFICER' &&
        p.module === 'campus' &&
        p.action === '*' &&
        p.effect === 'allow',
    );
    expect(match).toBeDefined();
    expect(match?.scope?.subDomain).toBe('transport');
    expect(match?.priority).toBe(750);
    expect(match?.isActive).toBe(true);
  });

  it('has a human-readable description', () => {
    const match = POLICIES.find(
      (p) => p.personaType === 'ST-TRANSPORT-OFFICER' && p.module === 'campus',
    );
    expect(match?.description).toBeTruthy();
    expect(match?.description?.toLowerCase()).toContain('transport');
  });

  it('behaviorally: filterPolicies + sortPolicies resolves to the transport policy for campus access', () => {
    const staffPolicies = forRole('staff');
    for (const action of ['read', 'create', 'update', 'delete']) {
      const filtered = filterPolicies(staffPolicies, 'campus', action, 'ST-TRANSPORT-OFFICER');
      const sorted = sortPolicies(filtered);
      const top = sorted[0];
      expect(top, `expected a top policy for campus:${action}`).toBeDefined();
      expect(top!.effect).toBe('allow');
      // The persona-specific policy must be the winning one (priority 750 vs base staff 600).
      expect(top!.personaType).toBe('ST-TRANSPORT-OFFICER');
      expect(top!.scope?.subDomain).toBe('transport');
    }
  });
});

describe('defaults.ts — ST-WARDEN extended to campus module', () => {
  it('includes a campus-module allow policy with subDomain=hostel', () => {
    const match = POLICIES.find(
      (p) =>
        p.role === 'staff' &&
        p.personaType === 'ST-WARDEN' &&
        p.module === 'campus' &&
        p.action === '*' &&
        p.effect === 'allow' &&
        p.scope?.subDomain === 'hostel',
    );
    expect(match).toBeDefined();
    expect(match?.priority).toBe(750);
    expect(match?.isActive).toBe(true);
  });

  it('preserves the existing welfare-module policy (subDomain=hostel,mess)', () => {
    const match = POLICIES.find(
      (p) =>
        p.role === 'staff' &&
        p.personaType === 'ST-WARDEN' &&
        p.module === 'welfare' &&
        p.scope?.subDomain === 'hostel,mess',
    );
    expect(match, 'existing warden welfare policy must not be removed').toBeDefined();
  });

  it('behaviorally: ST-WARDEN on campus:update sorts the hostel policy above any staff fallback', () => {
    const staffPolicies = forRole('staff');
    const filtered = filterPolicies(staffPolicies, 'campus', 'update', 'ST-WARDEN');
    const sorted = sortPolicies(filtered);
    const top = sorted[0];
    expect(top).toBeDefined();
    expect(top!.effect).toBe('allow');
    expect(top!.personaType).toBe('ST-WARDEN');
    expect(top!.scope?.subDomain).toBe('hostel');
  });
});

describe('defaults.ts — student role on campus module', () => {
  it('grants read on campus with selfOnly scope', () => {
    const match = POLICIES.find(
      (p) =>
        p.role === 'student' &&
        p.module === 'campus' &&
        p.action === 'read' &&
        p.effect === 'allow' &&
        p.scope?.selfOnly === true,
    );
    expect(match).toBeDefined();
    expect(match?.priority).toBeGreaterThanOrEqual(500);
  });

  it('grants update on campus with selfOnly + allocation subDomain scope', () => {
    const match = POLICIES.find(
      (p) =>
        p.role === 'student' &&
        p.module === 'campus' &&
        p.action === 'update' &&
        p.effect === 'allow' &&
        p.scope?.selfOnly === true,
    );
    expect(match).toBeDefined();
    // subDomain must cover both hostel-allocation and transport-allocation student actions.
    const sub = match?.scope?.subDomain ?? '';
    expect(sub).toContain('hostel-allocation');
    expect(sub).toContain('transport-allocation');
  });

  it('behaviorally: student campus:read resolves to selfOnly allow', () => {
    const studentPolicies = forRole('student');
    const filtered = filterPolicies(studentPolicies, 'campus', 'read', 'STU');
    const sorted = sortPolicies(filtered);
    const top = sorted[0];
    expect(top).toBeDefined();
    expect(top!.effect).toBe('allow');
    expect(top!.role).toBe('student');
    expect(top!.scope?.selfOnly).toBe(true);
  });

  it('behaviorally: student campus:update resolves to selfOnly allow with allocation subDomain', () => {
    const studentPolicies = forRole('student');
    const filtered = filterPolicies(studentPolicies, 'campus', 'update', 'STU');
    const sorted = sortPolicies(filtered);
    const top = sorted[0];
    expect(top).toBeDefined();
    expect(top!.effect).toBe('allow');
    expect(top!.role).toBe('student');
    expect(top!.scope?.selfOnly).toBe(true);
    expect(top!.scope?.subDomain).toContain('hostel-allocation');
  });
});

describe('defaults.ts — regression: unrelated policies intact', () => {
  it('still grants ST-TPO (Training & Placement Officer) full placement access', () => {
    const match = POLICIES.find(
      (p) =>
        p.personaType === 'ST-TPO' &&
        p.module === 'placement' &&
        p.action === '*' &&
        p.effect === 'allow',
    );
    expect(match, 'ST-TPO placement policy must remain (distinct from ST-TRANSPORT-OFFICER)').toBeDefined();
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
});
