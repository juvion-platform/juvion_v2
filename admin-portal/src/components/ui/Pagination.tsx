import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

interface Props {
  page: number;
  pages: number;
  /** Total matching records across all pages (from the paginate() envelope). */
  total?: number;
  limit?: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  /** Noun used in the count line, e.g. "students". */
  itemLabel?: string;
}

/**
 * Replaces the ad-hoc `Prev | Page X of Y | Next` block that was duplicated
 * across every list page. Adds the record count and a page-size selector the
 * audit flagged as missing, and stays rendered on single-page results so the
 * count is always visible.
 */
export default function Pagination({
  page, pages, total, limit, onPageChange, onLimitChange, itemLabel = 'records',
}: Props) {
  const safePages = Math.max(pages || 1, 1);
  const showing = typeof total === 'number' && typeof limit === 'number' && total > 0;
  const from = showing ? (page - 1) * limit + 1 : 0;
  const to = showing ? Math.min(page * limit, total) : 0;

  // Nothing worth rendering: a single page, no count, and no size selector.
  if (safePages <= 1 && !showing && !onLimitChange) return null;

  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-gray-500" aria-live="polite">
        {showing
          ? <>Showing <span className="font-medium text-gray-700">{from}–{to}</span> of{' '}
              <span className="font-medium text-gray-700">{total}</span> {itemLabel}</>
          : typeof total === 'number' && total === 0
            ? `No ${itemLabel}`
            : `Page ${page} of ${safePages}`}
      </p>

      <div className="flex items-center gap-3">
        {onLimitChange && (
          <label className="flex items-center gap-1.5 text-sm text-gray-500">
            <span className="hidden sm:inline">Rows</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              aria-label="Rows per page"
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-200"
            >
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}

        {safePages > 1 && (
          <nav className="flex items-center gap-2" aria-label="Pagination">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="inline-flex items-center gap-0.5 rounded border px-2.5 py-1 text-sm transition disabled:opacity-40 enabled:hover:bg-gray-50"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="text-sm text-gray-500">
              Page {page} of {safePages}
            </span>
            <button
              type="button"
              disabled={page >= safePages}
              onClick={() => onPageChange(page + 1)}
              className="inline-flex items-center gap-0.5 rounded border px-2.5 py-1 text-sm transition disabled:opacity-40 enabled:hover:bg-gray-50"
            >
              Next <ChevronRight size={14} />
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
