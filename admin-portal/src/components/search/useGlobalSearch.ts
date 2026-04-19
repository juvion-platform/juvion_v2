import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  searchPeople,
  type SearchResponse,
  type SearchResult,
  type PersonRole,
} from '../../services/search';

/**
 * Debounce window before a keystroke fires a search request.
 * 200ms feels responsive but prevents a network hit on every keypress
 * during fast typing.
 */
const DEBOUNCE_MS = 200;

/**
 * Minimum query length before we fire a request. Matches the backend's
 * Zod schema which rejects queries shorter than 2 chars.
 */
const MIN_QUERY_LENGTH = 2;

export interface UseGlobalSearchOpts {
  /** Default limit per request (1..25). Default: 10. */
  limit?: number;
  /** Include separated / inactive people. Admin-only (server enforces). */
  includeInactive?: boolean;
  /** If false, suspends the query (used by the header-inline mode). */
  enabled?: boolean;
}

export interface UseGlobalSearchReturn {
  /** Raw (un-debounced) query — bound to the input. */
  query: string;
  setQuery: (q: string) => void;
  /** The debounced query actually sent to the server. */
  deferredQuery: string;

  /** Results from the latest completed request (may be stale during typing). */
  results: SearchResult[];
  counts: Record<PersonRole, number>;
  totalMatched: number;
  hasMore: boolean;

  isLoading: boolean;
  isFetching: boolean;
  error: unknown;

  /** True when the user has typed enough to trigger a request. */
  isActive: boolean;

  /** UI-state: is the overlay / dropdown currently visible? */
  isOpen: boolean;
  setOpen: (open: boolean) => void;

  /** Convenience — clears query AND closes the overlay. */
  reset: () => void;
}

const EMPTY_COUNTS: Record<PersonRole, number> = {
  student: 0, faculty: 0, staff: 0, parent: 0, alumni: 0,
};

/**
 * Single source of truth for global-people-search state. Both the header
 * input and the Cmd+K overlay consume this hook, so debounce + request
 * semantics are defined in exactly one place.
 */
export function useGlobalSearch(opts: UseGlobalSearchOpts = {}): UseGlobalSearchReturn {
  const { limit = 10, includeInactive = false, enabled = true } = opts;

  const [query, setQuery] = useState('');
  const [deferredQuery, setDeferredQuery] = useState('');
  const [isOpen, setOpen] = useState(false);

  // Debounce: push `query` into `deferredQuery` after DEBOUNCE_MS of inactivity.
  // useDeferredValue would work for concurrent-mode prioritization but we want
  // a strict time-based debounce so the request count is predictable.
  useEffect(() => {
    const id = window.setTimeout(() => setDeferredQuery(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [query]);

  const shouldFetch =
    enabled && deferredQuery.length >= MIN_QUERY_LENGTH;

  const { data, isLoading, isFetching, error } = useQuery<SearchResponse>({
    queryKey: ['globalSearch', deferredQuery, limit, includeInactive],
    queryFn: ({ signal }) =>
      searchPeople({ q: deferredQuery, limit, includeInactive, signal }),
    enabled: shouldFetch,
    placeholderData: keepPreviousData,
    staleTime: 30_000, // cache results for 30s so Cmd+K reopen is instant
    retry: (failureCount, err) => {
      // Don't retry 4xx (validation, auth, rate-limit) — only true transient errors.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = (err as any)?.response?.status;
      if (typeof status === 'number' && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });

  const reset = useCallback(() => {
    setQuery('');
    setDeferredQuery('');
    setOpen(false);
  }, []);

  return {
    query,
    setQuery,
    deferredQuery,
    results: data?.results ?? [],
    counts: data?.counts ?? EMPTY_COUNTS,
    totalMatched: data?.totalMatched ?? 0,
    hasMore: data?.hasMore ?? false,
    isLoading: shouldFetch && isLoading,
    isFetching: shouldFetch && isFetching,
    error: shouldFetch ? error : null,
    isActive: shouldFetch,
    isOpen,
    setOpen,
    reset,
  };
}

// ── Cmd+K / Ctrl+K hotkey ──────────────────────────────────

/**
 * Listens for Cmd+K (macOS) or Ctrl+K (Windows/Linux) and calls `onOpen`.
 * Ignores the keystroke when focus is inside an editable control other than
 * an existing search input, so power users mid-form aren't interrupted only
 * if they explicitly opted in via the hint pill.
 *
 * Mount this ONCE at the layout level — mounting it per-component will fire
 * multiple handlers for a single keystroke.
 */
export function useGlobalSearchHotkey(onOpen: () => void): void {
  // Stable handler that always sees the latest onOpen closure without
  // re-binding the keydown listener on every render.
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const isMac = e.metaKey;
      const isNonMac = e.ctrlKey;
      const isKOrSlash = e.key === 'k' || e.key === 'K';
      if (!(isMac || isNonMac) || !isKOrSlash) return;

      e.preventDefault();
      onOpenRef.current();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
