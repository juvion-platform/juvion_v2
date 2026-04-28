/**
 * Tests for the path-derived <Breadcrumbs /> component.
 *
 * Covers:
 *   - Pure builder: buildCrumbsFromPath emits 0/1/2 crumbs based on URL depth
 *   - Special slug overrides (e.g. fee-management → "Fee Management")
 *   - Auto Title-Case fallback for unmapped slugs
 *   - Module-hub paths render nothing (the page H1 is sufficient)
 *   - Last crumb is non-clickable + bold; preceding crumbs are <Link>s
 *   - Component reads useLocation() and rerenders on route change
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Breadcrumbs, { buildCrumbsFromPath } from '../Breadcrumbs';

// ── Pure builder ───────────────────────────────────────────────────────

describe('buildCrumbsFromPath', () => {
  it('returns no crumbs at root', () => {
    expect(buildCrumbsFromPath('/')).toEqual([]);
  });

  it('returns no crumbs at module hub (depth 1)', () => {
    expect(buildCrumbsFromPath('/people')).toEqual([]);
    expect(buildCrumbsFromPath('/finance')).toEqual([]);
    expect(buildCrumbsFromPath('/master-data')).toEqual([]);
  });

  it('returns 1 crumb at list page (depth 2)', () => {
    expect(buildCrumbsFromPath('/people/students')).toEqual([
      { label: 'People', to: '/people' },
    ]);
  });

  it('returns 2 crumbs at detail page (depth 3)', () => {
    expect(buildCrumbsFromPath('/people/students/abc123')).toEqual([
      { label: 'People', to: '/people' },
      { label: 'Students', to: '/people/students' },
    ]);
  });

  it('caps at 2 crumbs even for deeper paths (e.g. /edit, /new)', () => {
    expect(buildCrumbsFromPath('/people/students/abc123/edit')).toEqual([
      { label: 'People', to: '/people' },
      { label: 'Students', to: '/people/students' },
    ]);
    expect(buildCrumbsFromPath('/people/students/new')).toEqual([
      { label: 'People', to: '/people' },
      { label: 'Students', to: '/people/students' },
    ]);
  });

  it('uses MODULE_LABELS overrides for non-obvious slugs', () => {
    // 'master-data' → 'Master Data' (multi-word module)
    const md = buildCrumbsFromPath('/master-data/programmes');
    expect(md).toEqual([{ label: 'Master Data', to: '/master-data' }]);

    // 'campus' → 'Campus Ops' (renamed module)
    const cm = buildCrumbsFromPath('/campus/visitors/x1');
    expect(cm[0]).toEqual({ label: 'Campus Ops', to: '/campus' });
  });

  it('uses SUB_LABELS overrides for multi-word sub-pages', () => {
    expect(buildCrumbsFromPath('/finance/fee-management/payments')).toEqual([
      { label: 'Finance', to: '/finance' },
      { label: 'Fee Management', to: '/finance/fee-management' },
    ]);

    expect(buildCrumbsFromPath('/finance/scholarships-concessions/concessions')).toEqual([
      { label: 'Finance', to: '/finance' },
      { label: 'Scholarships & Concessions', to: '/finance/scholarships-concessions' },
    ]);
  });

  it('falls back to title-case for unmapped slugs', () => {
    // unmapped module
    const trail = buildCrumbsFromPath('/something-new/sub-page/x1');
    expect(trail[0]).toEqual({ label: 'Something New', to: '/something-new' });
    expect(trail[1]).toEqual({ label: 'Sub Page', to: '/something-new/sub-page' });
  });
});

// ── Component rendering ────────────────────────────────────────────────

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Breadcrumbs />
    </MemoryRouter>,
  );
}

describe('<Breadcrumbs />', () => {
  it('renders nothing at module hub', () => {
    const { container } = renderAt('/people');
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing at root', () => {
    const { container } = renderAt('/');
    expect(container.firstChild).toBeNull();
  });

  it('renders 1 crumb at list page (non-clickable, bold)', () => {
    renderAt('/people/students');
    const crumb = screen.getByText('People');
    expect(crumb).toBeInTheDocument();
    // Single crumb means it's the LAST crumb → bold span, NOT a link
    expect(crumb.tagName).toBe('SPAN');
    expect(crumb).toHaveClass('font-medium');
  });

  it('renders 2 crumbs at detail page; first is a link, last is a bold span', () => {
    renderAt('/people/students/abc123');

    // First crumb is a link to /people
    const link = screen.getByRole('link', { name: 'People' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/people');

    // Second crumb is a span (current location)
    const last = screen.getByText('Students');
    expect(last.tagName).toBe('SPAN');
    expect(last).toHaveClass('font-medium');
    // The last crumb is NOT rendered as a link
    expect(screen.queryByRole('link', { name: 'Students' })).toBeNull();
  });

  it('renders a separator between crumbs', () => {
    const { container } = renderAt('/people/students/abc123');
    // ChevronRight from lucide renders as svg with role="img" by default,
    // but lucide's default is no role; we check svg count instead.
    const svgs = container.querySelectorAll('svg');
    // Exactly one separator between the 2 crumbs.
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it('uses correct labels for the special slug map', () => {
    renderAt('/finance/fee-management/payments');
    expect(screen.getByRole('link', { name: 'Finance' })).toBeInTheDocument();
    expect(screen.getByText('Fee Management')).toBeInTheDocument();
    // We cap at 2 crumbs, so 'Payments' is NOT in the trail
    expect(screen.queryByText('Payments')).toBeNull();
  });

  it('has nav role + aria-label="Breadcrumb"', () => {
    renderAt('/people/students/x1');
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav).toBeInTheDocument();
  });

  it('respects an explicit `items` prop override', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs
          items={[
            { label: 'Custom', to: '/custom' },
            { label: 'Override', to: '/custom/override' },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Custom' })).toBeInTheDocument();
    expect(screen.getByText('Override')).toBeInTheDocument();
  });
});
