import clsx from 'clsx';
import { User } from 'lucide-react';
import Badge from '../ui/Badge';
import type { PersonRole, SearchResult } from '../../services/search';

/**
 * Single search-result row. Pure presentation — no data fetching, no state.
 *
 * Used by SearchResultsDropdown and SearchResults page. Safe to render
 * hundreds of these since they hold no effects.
 */

const ROLE_LABELS: Record<PersonRole, string> = {
  student: 'Student',
  faculty: 'Faculty',
  staff: 'Staff',
  parent: 'Parent',
  alumni: 'Alumnus',
};

const ROLE_BADGES: Record<PersonRole, string> = {
  student: 'info',
  faculty: 'purple',
  staff: 'teal',
  parent: 'orange',
  alumni: 'success',
};

export interface SearchResultRowProps {
  result: SearchResult;
  selected?: boolean;
  onClick: () => void;
  onHover?: () => void;
  /** Stable id for aria-activedescendant wiring from the parent listbox. */
  id?: string;
}

export default function SearchResultRow({
  result, selected = false, onClick, onHover, id,
}: SearchResultRowProps) {
  const initial = result.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <button
      type="button"
      role="option"
      id={id}
      aria-selected={selected}
      onClick={onClick}
      onMouseEnter={onHover}
      className={clsx(
        'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
        'focus:outline-none',
        selected ? 'bg-primary-50' : 'hover:bg-gray-50',
      )}
    >
      {/* Photo or initial */}
      <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 overflow-hidden flex-shrink-0">
        {result.photo ? (
          <img
            src={result.photo}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : result.name ? (
          <span className="text-sm font-medium">{initial}</span>
        ) : (
          <User className="w-4 h-4" />
        )}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">{result.name}</span>
          <Badge variant={ROLE_BADGES[result.role]}>
            {ROLE_LABELS[result.role]}
          </Badge>
          {result.status && result.status !== 'active' && (
            <Badge variant="default">{result.status}</Badge>
          )}
        </div>
        <div className="text-xs text-gray-500 truncate mt-0.5">
          {result.identifier && (
            <>
              <span className="font-medium">{result.identifierLabel}:</span>{' '}
              <span>{result.identifier}</span>
              {result.department && <span className="mx-1.5">·</span>}
            </>
          )}
          {result.department && <span>{result.department}</span>}
        </div>
      </div>
    </button>
  );
}

// Exported so the dropdown can group by role with the same labels.
export { ROLE_LABELS };
