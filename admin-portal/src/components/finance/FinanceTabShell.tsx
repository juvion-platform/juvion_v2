/**
 * FinanceTabShell — horizontal scrollable tab bar used by Fee Management,
 * Scholarships & Concessions, and Accounting. Each tab is a NavLink so that
 * the browser URL, back/forward navigation, and deep links work naturally.
 *
 * The shell renders:
 *   - Group title + optional description
 *   - Horizontal tab row (scrolls on overflow for small viewports)
 *   - An <Outlet> / children slot for the active tab's page content
 *
 * Visual style mirrors FinancialHoldsPage's existing tab pattern (blue
 * active underline, slate-500 inactive) so the look stays consistent with
 * other tabbed surfaces already in the portal.
 */

import { NavLink } from 'react-router-dom';

export interface FinanceTabDef {
  to: string;
  label: string;
  /** Optional tiny number shown next to the label (e.g. pending count). */
  count?: number | null;
}

export interface FinanceTabShellProps {
  title: string;
  description?: string;
  tabs: FinanceTabDef[];
  children: React.ReactNode;
}

export default function FinanceTabShell({
  title,
  description,
  tabs,
  children,
}: FinanceTabShellProps) {
  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-navy">{title}</h2>
        {description ? (
          <p className="text-sm text-slate-500 mt-0.5">{description}</p>
        ) : null}
      </div>

      {/* Tab row */}
      <div className="border-b border-slate-200 mb-5 overflow-x-auto">
        <nav className="flex gap-1 min-w-max" aria-label={`${title} tabs`}>
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end
              className={({ isActive }) =>
                [
                  'whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                  isActive
                    ? 'border-primary-500 text-primary-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
                ].join(' ')
              }
            >
              <span className="flex items-center gap-2">
                {tab.label}
                {typeof tab.count === 'number' && tab.count > 0 ? (
                  <span className="inline-flex items-center justify-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                    {tab.count}
                  </span>
                ) : null}
              </span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>{children}</div>
    </div>
  );
}
