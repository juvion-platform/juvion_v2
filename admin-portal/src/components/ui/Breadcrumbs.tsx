/**
 * Path-derived breadcrumb trail. Reads the current URL via
 * `useLocation()` and emits up to two clickable crumbs corresponding
 * to the parent module and the parent list page.
 *
 * Examples:
 *   /people                                  →  (no crumbs — at hub)
 *   /people/students                         →  People
 *   /people/students/<id>                    →  People  ›  Students
 *   /people/students/<id>/edit               →  People  ›  Students
 *   /people/students/new                     →  People  ›  Students
 *   /finance                                 →  (no crumbs — at hub)
 *   /finance/dashboard                       →  Finance
 *   /finance/fee-management                  →  Finance
 *   /finance/fee-management/payments         →  Finance  ›  Fee Management
 *   /master-data/programmes                  →  Master Data
 *
 * Single horizontal line, small gray text, ChevronRight separators.
 * The last crumb (parent of current page) is non-clickable + slightly
 * bolder so the user reads it as the deepest visible level.
 *
 * Special slug labels live in SUB_LABELS below; everything else is
 * auto-Title-Cased from its kebab-case slug.
 */

import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface Crumb {
  label: string;
  to: string;
}

// Module slug → display label. The first URL segment maps to one of
// these. Add new modules here; everything else falls back to title-case
// of the slug.
const MODULE_LABELS: Record<string, string> = {
  admissions: 'Admissions',
  people: 'People',
  academics: 'Academics',
  finance: 'Finance',
  hr: 'HR',
  welfare: 'Welfare',
  placement: 'Placement',
  campus: 'Campus Ops',
  'student-dev': 'Student Dev',
  compliance: 'Compliance',
  governance: 'Governance',
  platform: 'Platform',
  juvi: 'Juvi AI',
  'master-data': 'Master Data',
  colleges: 'Colleges',
};

// Per-module overrides for sub-page slugs whose auto-title-case is wrong
// or unhelpful (e.g. "Student Fee Accounts" is too verbose). Most slugs
// auto-derive their label.
const SUB_LABELS: Record<string, Record<string, string>> = {
  people: {
    students: 'Students',
    faculty: 'Faculty',
    staff: 'Staff',
    parents: 'Parents',
    persons: 'Persons',
    organizations: 'Organizations',
  },
  finance: {
    dashboard: 'Dashboard',
    'fee-management': 'Fee Management',
    'scholarships-concessions': 'Scholarships & Concessions',
    accounting: 'Accounting',
    overview: 'Overview',
    'fee-structures': 'Fee Structures',
    'component-template': 'Component Template',
    'student-fee-accounts': 'Fee Accounts',
    'fee-line-items': 'Fee Line Items',
    payments: 'Payments',
    invoices: 'Invoices',
    reminders: 'Fee Reminders',
    fines: 'Fines & Penalties',
    holds: 'Financial Holds',
    scholarships: 'Scholarships',
    'scholarship-allocations': 'Scholarship Allocations',
    concessions: 'Concessions',
    refunds: 'Refunds',
    budgets: 'Budgets',
    expenses: 'Expenses',
    ledger: 'Ledger',
  },
  'master-data': {
    departments: 'Departments',
    programmes: 'Programmes',
    branches: 'Branches',
    designations: 'Designations',
  },
};

/**
 * Convert a kebab-case URL slug into a Title-Case display label.
 * `student-fee-accounts` → `Student Fee Accounts`. Used as a fallback
 * when no explicit label is registered.
 */
function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(' ');
}

function moduleLabel(slug: string): string {
  return MODULE_LABELS[slug] ?? titleCase(slug);
}

function subLabel(moduleSlug: string, slug: string): string {
  return SUB_LABELS[moduleSlug]?.[slug] ?? titleCase(slug);
}

/**
 * Derive a 0-, 1-, or 2-crumb trail from a URL pathname. Returns an
 * empty array when the path is a module hub (depth 1) — the page H1 is
 * sufficient there.
 *
 * Strategy:
 *   - 0 segments  → no crumbs (root)
 *   - 1 segment   → no crumbs (at module hub; the H1 says it all)
 *   - 2 segments  → 1 crumb (module); we're on a list / sub-page whose
 *                   own H1 names the location
 *   - 3+ segments → 2 crumbs (module + parent list); we're inside a
 *                   detail / tab / form page
 */
export function buildCrumbsFromPath(pathname: string): Crumb[] {
  const segs = pathname.split('/').filter(Boolean);
  if (segs.length === 0) return [];

  const moduleSlug = segs[0]!;
  const crumbs: Crumb[] = [];

  if (segs.length === 1) return crumbs;          // at module hub
  crumbs.push({ label: moduleLabel(moduleSlug), to: `/${moduleSlug}` });

  if (segs.length === 2) return crumbs;          // at list page; module crumb is enough
  const subSlug = segs[1]!;
  crumbs.push({
    label: subLabel(moduleSlug, subSlug),
    to: `/${moduleSlug}/${subSlug}`,
  });

  return crumbs;
}

interface Props {
  /** Override the path-derived trail (rarely needed; debug only). */
  items?: Crumb[];
  /** Extra Tailwind classes — typically `mb-4` to space against the page header. */
  className?: string;
}

export default function Breadcrumbs({ items, className = '' }: Props) {
  const location = useLocation();
  const crumbs = items ?? buildCrumbsFromPath(location.pathname);

  if (crumbs.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1 text-sm text-gray-500 ${className}`}
    >
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <Fragment key={`${c.to}-${i}`}>
            {isLast ? (
              <span className="font-medium text-gray-700">{c.label}</span>
            ) : (
              <Link
                to={c.to}
                className="hover:text-gray-700 transition-colors"
              >
                {c.label}
              </Link>
            )}
            {!isLast && (
              <ChevronRight size={14} className="text-gray-400" aria-hidden />
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
