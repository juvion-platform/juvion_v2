import { useMemo, useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Inbox } from 'lucide-react';

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  /**
   * Opt a column out of click-to-sort (e.g. an actions column). Sorting is
   * enabled by default for columns whose key maps to a row field.
   */
  sortable?: boolean;
  /** Custom comparable value when the raw field isn't directly sortable. */
  sortValue?: (row: T) => string | number | Date | null | undefined;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyState?: React.ReactNode;
  /**
   * Short context line under the generic empty icon, e.g.
   * "No students match this filter." Falls back to a neutral message.
   */
  emptyMessage?: string;
  /** Optional call-to-action rendered under the empty message. */
  emptyAction?: React.ReactNode;
  /**
   * Returns extra props to spread onto each `<tr>`. Used by `useHighlightRow`
   * to tag rows with `data-highlight-id` for scroll-to + flash when arriving
   * from global-people-search. Optional; existing callers unaffected.
   */
  rowProps?: (row: T, index: number) => Record<string, string | number | boolean | undefined>;
  /**
   * Returns a stable id for the row, used as the React key. When omitted,
   * falls back to the array index (preserves old behavior).
   */
  rowKey?: (row: T, index: number) => string | number;
  /**
   * When `onRowClick` is set, this can selectively disable clickability on
   * specific rows (e.g. unlinked Persons that have no detail page). Such
   * rows render without the pointer cursor or hover tint — honest affordance.
   * Defaults to true (every row clickable when onRowClick is set).
   */
  rowClickable?: (row: T, index: number) => boolean;
  /**
   * Accessible name for a clickable row. Screen readers otherwise announce a
   * bare "button" with no context.
   */
  rowLabel?: (row: T, index: number) => string;
  /** Disable client-side sorting (e.g. when the server already sorts). */
  disableSort?: boolean;
  /** Number of placeholder rows to render while loading. */
  skeletonRows?: number;
}

type SortDir = 'asc' | 'desc';

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  const as = String(a);
  const bs = String(b);
  // Dates and numeric strings sort correctly under numeric collation.
  return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
}

export default function DataTable<T extends Record<string, any>>({
  columns, data, onRowClick, loading, emptyState, emptyMessage, emptyAction,
  rowProps, rowKey, rowClickable, rowLabel, disableSort, skeletonRows = 6,
}: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null);

  const sorted = useMemo(() => {
    if (!sort || disableSort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return data;
    const value = col.sortValue ?? ((row: T) => row[col.key]);
    // Copy first — never mutate the array React Query handed us.
    return [...data].sort((x, y) => {
      const res = compare(value(x), value(y));
      return sort.dir === 'asc' ? res : -res;
    });
  }, [data, sort, columns, disableSort]);

  function toggleSort(key: string) {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: 'asc' };
      if (cur.dir === 'asc') return { key, dir: 'desc' };
      return null; // third click clears sorting
    });
  }

  // Skeleton rows preserve the table's height so the page doesn't jump when
  // data lands — the old plain "Loading..." collapsed the whole container.
  if (loading) {
    return (
      <div className="overflow-x-auto bg-white rounded-xl border shadow-sm" aria-busy="true">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 text-left font-medium text-gray-600">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-3.5 animate-pulse rounded bg-slate-100" style={{ width: `${55 + ((i * 13 + col.key.length * 7) % 40)}%` }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <span className="sr-only">Loading data…</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-xl border shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            {columns.map((col) => {
              const canSort = !disableSort && col.sortable !== false;
              const active = sort?.key === col.key;
              const ariaSort = active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none';
              if (!canSort) {
                return (
                  <th key={col.key} className="px-4 py-3 text-left font-medium text-gray-600">{col.label}</th>
                );
              }
              return (
                <th
                  key={col.key}
                  aria-sort={ariaSort}
                  className="px-4 py-3 text-left font-medium text-gray-600"
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="group inline-flex items-center gap-1 rounded transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                    title={`Sort by ${col.label}`}
                  >
                    {col.label}
                    {active
                      ? (sort!.dir === 'asc'
                        ? <ArrowUp size={13} className="text-primary-600" />
                        : <ArrowDown size={13} className="text-primary-600" />)
                      : <ArrowUpDown size={13} className="text-gray-300 transition-colors group-hover:text-gray-400" />}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                {emptyState || (
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <Inbox size={18} />
                    </span>
                    <p className="text-sm text-gray-500">{emptyMessage || 'No records to show yet.'}</p>
                    {emptyAction}
                  </div>
                )}
              </td>
            </tr>
          ) : sorted.map((row, i) => {
            const extra = rowProps ? rowProps(row, i) : undefined;
            const key = rowKey ? rowKey(row, i) : i;
            // Clickable rows get:
            //   - pointer cursor
            //   - brand-tinted hover background (distinct from default neutral)
            //   - subtle left accent on hover to reinforce "this is actionable"
            //   - smooth transition so the affordance feels intentional, not a flash
            //   - accessibility: role="button" + tabIndex so keyboard users can
            //     Enter/Space to activate the row, plus an aria-label so the
            //     announcement is not a context-free "button"
            const clickable = Boolean(onRowClick)
              && (rowClickable ? rowClickable(row, i) : true);
            const onKeyDown = clickable
              ? (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRowClick?.(row);
                  }
                }
              : undefined;
            const label = clickable
              ? (rowLabel?.(row, i)
                ?? `View details for ${String(row.name ?? row.title ?? row.code ?? row.email ?? `row ${i + 1}`)}`)
              : undefined;
            return (
              <tr
                key={key}
                onClick={clickable ? () => onRowClick!(row) : undefined}
                onKeyDown={onKeyDown}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                aria-label={label}
                className={
                  clickable
                    ? 'cursor-pointer transition-colors duration-150 hover:bg-primary-50/70 focus:bg-primary-50/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-inset border-l-2 border-transparent hover:border-primary-400'
                    : ''
                }
                {...extra}
              >
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3">{col.render ? col.render(row) : row[col.key]}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
