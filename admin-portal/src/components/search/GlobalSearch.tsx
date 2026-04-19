import { useCallback, useEffect, useState } from 'react';
import { Search as SearchIcon, Command, X } from 'lucide-react';
import SearchOverlay from './SearchOverlay';
import { useGlobalSearchHotkey } from './useGlobalSearch';

/**
 * Header search trigger. Renders:
 *   - A compact icon-only button on narrow viewports (≤ md breakpoint).
 *   - A wider "search pill" with placeholder + ⌘K hint on larger viewports.
 *
 * Clicking either opens the full SearchOverlay. Cmd+K / Ctrl+K also opens it.
 *
 * The actual search input lives in the overlay, not here — the header pill
 * is purely a trigger. This keeps the two "modes" from the spec (inline
 * typing on desktop vs. modal on mobile) from diverging; users always see
 * the same results UI.
 */

const HINT_STORAGE_KEY = 'gps:hint-seen';

export default function GlobalSearch() {
  const [isOpen, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Cmd+K / Ctrl+K opens the overlay from anywhere in the layout.
  useGlobalSearchHotkey(() => setOpen(true));

  // First-time tooltip: show once per browser, then never again.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const seen = localStorage.getItem(HINT_STORAGE_KEY) === 'true';
      if (!seen) setShowHint(true);
    } catch {
      // localStorage blocked (incognito with restrictive settings) — just skip.
    }
  }, []);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    try { localStorage.setItem(HINT_STORAGE_KEY, 'true'); } catch { /* ignore */ }
  }, []);

  const openOverlay = useCallback(() => {
    setOpen(true);
    if (showHint) dismissHint();
  }, [showHint, dismissHint]);

  return (
    <>
      {/* Compact icon — mobile / narrow layouts */}
      <button
        type="button"
        onClick={openOverlay}
        aria-label="Search people (Cmd+K)"
        className="md:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <SearchIcon className="w-5 h-5" />
      </button>

      {/* Expanded pill — desktop */}
      <button
        type="button"
        onClick={openOverlay}
        aria-label="Search people (Cmd+K)"
        className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 w-64 lg:w-80 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500 transition-colors"
      >
        <SearchIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="flex-1 text-left">Search people…</span>
        <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-white border border-gray-200 rounded text-gray-500">
          <Command className="w-3 h-3" />K
        </kbd>
      </button>

      {/* First-time tooltip */}
      {showHint && (
        <div
          role="status"
          className="absolute top-full right-0 mt-2 z-40 flex items-start gap-2 px-3 py-2 bg-navy text-white text-xs rounded-lg shadow-lg max-w-xs"
        >
          <span>
            New: press{' '}
            <kbd className="px-1 py-0.5 bg-white/20 rounded">⌘K</kbd>
            {' '}to search for anyone.
          </span>
          <button
            type="button"
            onClick={dismissHint}
            aria-label="Dismiss"
            className="p-0.5 rounded hover:bg-white/20 flex-shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/*
        Admin-only "Include inactive" toggle is rendered on the /search page
        per spec §5.3; the Cmd+K overlay stays simple and always queries
        active-only. The server silently downgrades for non-admin anyway.
      */}
      <SearchOverlay
        isOpen={isOpen}
        onClose={() => setOpen(false)}
        includeInactive={false}
      />
    </>
  );
}
