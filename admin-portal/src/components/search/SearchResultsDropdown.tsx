import { useMemo } from 'react';
import { AlertCircle, Search as SearchIcon, Loader2 } from 'lucide-react';
import SearchResultRow, { ROLE_LABELS } from './SearchResultRow';
import type { PersonRole, SearchResult } from '../../services/search';

/**
 * Grouped results list. Stateless — all state flows in via props from
 * useGlobalSearch. See SearchOverlay / GlobalSearch for how it wires up.
 */

export type DropdownState =
  | 'idle'     // nothing typed yet (< 2 chars)
  | 'loading'  // first-time fetch in progress
  | 'empty'    // 2+ chars typed, zero results
  | 'error'    // fetch failed
  | 'ready';   // results to show

// Ordering for the role sections. Students first because they're the
// majority case; alumni last because they're the least-commonly searched.
const ROLE_ORDER: PersonRole[] = ['student', 'faculty', 'staff', 'parent', 'alumni'];

export interface SearchResultsDropdownProps {
  state: DropdownState;
  results: SearchResult[];
  counts: Record<PersonRole, number>;
  totalMatched: number;
  hasMore: boolean;
  query: string;
  /** Linear index across the flattened (role-grouped) list. */
  selectedIndex: number;
  onSelect: (index: number) => void;
  onHover?: (index: number) => void;
  /** Invoked when the user clicks "See all N results". */
  onSeeAll: () => void;
  /** Optional retry hook for the error state. */
  onRetry?: () => void;
  /** Listbox id — used by the input's aria-controls. */
  id?: string;
}

export default function SearchResultsDropdown(props: SearchResultsDropdownProps) {
  const {
    state, results, counts, totalMatched, hasMore, query,
    selectedIndex, onSelect, onHover, onSeeAll, onRetry, id,
  } = props;

  // Group by role in the canonical order. Flatten for keyboard nav:
  // each row's DOM index must match its position in the overall list
  // so `selectedIndex` maps 1:1.
  const grouped = useMemo(() => {
    const byRole = new Map<PersonRole, SearchResult[]>();
    for (const r of results) {
      const arr = byRole.get(r.role) ?? [];
      arr.push(r);
      byRole.set(r.role, arr);
    }
    return ROLE_ORDER
      .filter(role => (byRole.get(role)?.length ?? 0) > 0)
      .map(role => ({ role, rows: byRole.get(role)! }));
  }, [results]);

  if (state === 'idle') {
    return (
      <div className="p-6 text-center text-sm text-gray-500" role="status">
        <SearchIcon className="w-6 h-6 mx-auto mb-2 text-gray-300" />
        Type at least 2 characters to search
      </div>
    );
  }

  if (state === 'loading' && results.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-gray-500" role="status">
        <Loader2 className="w-5 h-5 mx-auto mb-2 text-gray-400 animate-spin" />
        Searching…
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="p-6 text-center text-sm text-red-600" role="alert">
        <AlertCircle className="w-5 h-5 mx-auto mb-2" />
        <div>Couldn't search. </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-primary-600 hover:text-primary-700 underline"
          >
            Click to retry
          </button>
        )}
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div className="p-6 text-center text-sm text-gray-500" role="status">
        <p>No people match &ldquo;{query}&rdquo;.</p>
        {/* Global search covers people only. Saying so here is the difference
            between "there is no such record" and "you searched the wrong
            index" — courses, branches and fees each have their own search. */}
        <p className="mt-1.5 text-xs text-gray-400">
          This searches students, faculty, staff, parents and alumni. For courses,
          branches or fees, use the search box on that module&rsquo;s page.
        </p>
      </div>
    );
  }

  // state === 'ready'
  let flatIndex = 0;
  return (
    <div role="listbox" id={id} className="max-h-96 overflow-y-auto">
      {grouped.map(({ role, rows }) => (
        <div key={role}>
          <div className="sticky top-0 px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide border-b border-gray-100">
            {ROLE_LABELS[role]}s · {counts[role]}
          </div>
          {rows.map((r) => {
            const i = flatIndex++;
            return (
              <SearchResultRow
                key={r._id}
                id={`gps-option-${i}`}
                result={r}
                selected={i === selectedIndex}
                onClick={() => onSelect(i)}
                onHover={onHover ? () => onHover(i) : undefined}
              />
            );
          })}
        </div>
      ))}

      {hasMore && (
        <button
          type="button"
          onClick={onSeeAll}
          className="w-full px-3 py-2.5 text-sm text-primary-600 hover:bg-primary-50 text-left font-medium border-t border-gray-100"
        >
          See all {totalMatched} results for &ldquo;{query}&rdquo; →
        </button>
      )}
    </div>
  );
}
