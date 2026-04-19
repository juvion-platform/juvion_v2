import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, X, Command } from 'lucide-react';
import SearchResultsDropdown, { type DropdownState } from './SearchResultsDropdown';
import { useGlobalSearch } from './useGlobalSearch';
import { routeForResult } from './navigateToResult';

/**
 * Full-screen Cmd+K search overlay.
 *
 * State comes from `useGlobalSearch`. Keyboard model:
 *   - Esc closes
 *   - ↑/↓ moves selectedIndex (wraps at bounds)
 *   - Enter navigates to the selected result
 *   - Tab cycles within the overlay (focus trap)
 *   - Backdrop click closes
 *
 * Mount ONCE at the layout level — the overlay is a singleton.
 */

export interface SearchOverlayProps {
  /** External control — the header component owns open/close state. */
  isOpen: boolean;
  onClose: () => void;
  /** Admin-only: pass true to include separated / inactive people. */
  includeInactive?: boolean;
}

export default function SearchOverlay({
  isOpen, onClose, includeInactive = false,
}: SearchOverlayProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Scope the hook's per-instance state to this overlay — enabled only when
  // open so we don't fire requests for a hidden modal.
  const s = useGlobalSearch({
    limit: 10,
    includeInactive,
    enabled: isOpen,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection whenever the results identity changes (new query lands).
  useEffect(() => {
    setSelectedIndex(0);
  }, [s.results]);

  // Derive the DropdownState from the hook's flags.
  const state: DropdownState = (() => {
    if (!s.isActive) return 'idle';
    if (s.error) return 'error';
    if (s.isLoading) return 'loading';
    if (s.results.length === 0) return 'empty';
    return 'ready';
  })();

  // ── Effects: focus, body-scroll, backdrop, Esc ─────────
  // Focus the input on open.
  useEffect(() => {
    if (!isOpen) return;
    // Defer to next frame so the input is mounted before we focus it.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [isOpen]);

  // Lock body scroll while the overlay is open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Clear input when the overlay closes so the next open starts fresh.
  useEffect(() => {
    if (!isOpen) s.setQuery('');
    // Only reset on transition to closed; don't include `s` (stale-closure safe).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const commitSelection = useCallback((index: number) => {
    const row = s.results[index];
    if (!row) return;
    onClose();
    navigate(routeForResult(row));
  }, [s.results, onClose, navigate]);

  const goSeeAll = useCallback(() => {
    const q = s.deferredQuery;
    if (!q) return;
    onClose();
    navigate(`/search?q=${encodeURIComponent(q)}${includeInactive ? '&includeInactive=true' : ''}`);
  }, [s.deferredQuery, includeInactive, navigate, onClose]);

  // ── Keyboard: arrows / Enter / Esc ─────────────────────
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (state !== 'ready') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % s.results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + s.results.length) % s.results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commitSelection(selectedIndex);
    }
  }, [state, s.results.length, selectedIndex, commitSelection, onClose]);

  // Focus trap: cycle Tab within the dialog.
  const onTrapKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'input, button, [href], [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-24"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Global people search"
        onKeyDown={(e) => { onKeyDown(e); onTrapKeyDown(e); }}
        className="relative w-full max-w-2xl mx-4 bg-white rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <SearchIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={state === 'ready'}
            aria-controls="gps-listbox"
            aria-autocomplete="list"
            aria-activedescendant={
              state === 'ready' ? `gps-option-${selectedIndex}` : undefined
            }
            placeholder="Search students, faculty, staff, parents, alumni…"
            value={s.query}
            onChange={(e) => s.setQuery(e.target.value)}
            className="flex-1 text-base outline-none placeholder-gray-400"
            // Browser autocomplete gets in the way of fast typing.
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {s.query && (
            <button
              type="button"
              onClick={() => s.setQuery('')}
              aria-label="Clear search"
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs text-gray-500 bg-gray-100 rounded border border-gray-200">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <SearchResultsDropdown
          id="gps-listbox"
          state={state}
          results={s.results}
          counts={s.counts}
          totalMatched={s.totalMatched}
          hasMore={s.hasMore}
          query={s.deferredQuery}
          selectedIndex={selectedIndex}
          onSelect={commitSelection}
          onHover={setSelectedIndex}
          onSeeAll={goSeeAll}
        />

        {/* Footer hint */}
        {state === 'ready' && (
          <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">↑↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">↵</kbd>
                to open
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Command className="w-3 h-3" /> K to toggle
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
