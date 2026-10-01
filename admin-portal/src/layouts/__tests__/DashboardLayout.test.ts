import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, getVisibleNavItems } from '../DashboardLayout';

describe('DashboardLayout navigation visibility', () => {
  it('Dashboard is always visible regardless of permissions', () => {
    const items = getVisibleNavItems(NAV_ITEMS, () => false);
    expect(items.map((i) => i.label)).toEqual(['Dashboard']);
  });

  it('filters navigation items based on module read permission', () => {
    const canRead = (m: string) => ['finance', 'academics'].includes(m);
    const items = getVisibleNavItems(NAV_ITEMS, canRead);
    const labels = items.map((i) => i.label);
    expect(labels).toContain('Dashboard');
    expect(labels).toContain('Finance');
    expect(labels).toContain('Academics');
    expect(labels).toContain('Master Data'); // gated on academics
    expect(labels).not.toContain('HR');
    expect(labels).not.toContain('Welfare');
    expect(labels).not.toContain('Admissions');
  });

  it('restricts sidebar items for specialized staff (Accounts) via accessibleModules', () => {
    // Even if staff role has broad read fallback permissions, accessibleModules restricts to Finance
    const canReadAll = () => true;
    const items = getVisibleNavItems(NAV_ITEMS, canReadAll, ['finance']);
    const labels = items.map((i) => i.label);
    expect(labels).toEqual(['Dashboard', 'Finance']);
  });

  it('restricts sidebar items for Warden via accessibleModules', () => {
    const canReadAll = () => true;
    const items = getVisibleNavItems(NAV_ITEMS, canReadAll, ['welfare', 'campus']);
    const labels = items.map((i) => i.label);
    expect(labels).toEqual(['Dashboard', 'Welfare', 'Campus Ops']);
  });

  it('shows full accessible navigation for Leadership when accessibleModules is not set', () => {
    const canReadAll = () => true;
    const items = getVisibleNavItems(NAV_ITEMS, canReadAll, undefined);
    expect(items.length).toBe(NAV_ITEMS.length);
  });
});
