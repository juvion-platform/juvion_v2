import { useCallback, useMemo, useState } from 'react';

interface Options {
  initialLimit?: number;
  initialSearch?: string;
}

/**
 * Standard page/limit/search state for list pages. Changing the page size or
 * the query resets to page 1 — otherwise a user on page 3 of 3 who switches to
 * 100 rows lands on an empty page.
 */
export function useListControls({ initialLimit = 20, initialSearch = '' }: Options = {}) {
  const [page, setPage] = useState(1);
  const [limit, setLimitRaw] = useState(initialLimit);
  const [search, setSearchRaw] = useState(initialSearch);

  const setLimit = useCallback((next: number) => {
    setLimitRaw(next);
    setPage(1);
  }, []);

  const setSearch = useCallback((next: string) => {
    setSearchRaw(next);
    setPage(1);
  }, []);

  return useMemo(
    () => ({ page, setPage, limit, setLimit, search, setSearch }),
    [page, limit, search, setLimit, setSearch],
  );
}

/**
 * Client-side fallback filter for list endpoints that don't accept a `search`
 * param yet. Matches case-insensitively against the given fields (or every
 * string/number field when none are named).
 */
export function filterRows<T extends Record<string, any>>(rows: T[], query: string, fields?: string[]): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const values = fields
      ? fields.map((f) => f.split('.').reduce<any>((acc, k) => (acc == null ? acc : acc[k]), row))
      : Object.values(row);
    return values.some((v) => {
      if (v == null) return false;
      const t = typeof v;
      if (t !== 'string' && t !== 'number' && t !== 'boolean') return false;
      return String(v).toLowerCase().includes(q);
    });
  });
}
