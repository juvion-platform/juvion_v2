import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Consumes the `?highlight=<personId>` URL parameter that global-people-search
 * passes when navigating from search results to a list page.
 *
 * Contract:
 *   - Every row in the list tags itself with `data-highlight-id={personId}`
 *     via the `highlightAttrs(personId)` helper this hook returns.
 *   - The hook scrolls the matching row into view and briefly flashes its
 *     background once the data has loaded (`ready` flips to true).
 *   - After firing once, the `highlight` param is stripped from the URL so
 *     navigating back/forward or re-rendering doesn't re-trigger the flash.
 *   - If the target person isn't on the current page (e.g. pagination),
 *     the hook silently no-ops after a short retry window.
 *
 * Usage in a list page:
 * ```tsx
 * const { highlightAttrs } = useHighlightRow({ ready: !isLoading });
 * <DataTable
 *   rowProps={(row) => highlightAttrs(row.person?._id ?? row.personId?._id)}
 *   ...
 * />
 * ```
 */

const FLASH_DURATION_MS = 2500;
// Short polling window to handle the case where data resolves asynchronously
// right after the hook fires but before the <tr> is painted.
const RETRY_INTERVAL_MS = 100;
const RETRY_MAX_MS = 2000;

export interface UseHighlightRowOpts {
  /**
   * Flip to true once the list data has loaded. The hook waits for this
   * before trying to locate and scroll the matching row.
   */
  ready: boolean;
}

export interface HighlightRowApi {
  /** The highlighted personId from the URL, or null. Exposed for edge cases. */
  highlightId: string | null;
  /**
   * Returns DOM attributes to spread onto a row. Tags every row with
   * `data-highlight-id={personId}` so the hook's querySelector can locate
   * the matching one. Returns an empty object when `personId` is falsy.
   */
  highlightAttrs: (personId: string | undefined | null) => Record<string, string>;
}

export function useHighlightRow({ ready }: UseHighlightRowOpts): HighlightRowApi {
  const [params, setParams] = useSearchParams();
  const highlightId = params.get('highlight');

  // Track whether we already fired the flash for this highlightId so React
  // Query refetches (stale-data replay, pagination) don't re-flash the row.
  const firedFor = useRef<string | null>(null);

  // Effect: attempt to locate the row, scroll, flash, then strip the param.
  useEffect(() => {
    if (!highlightId || !ready) return;
    if (firedFor.current === highlightId) return;

    const started = Date.now();
    let timerId: number | undefined;

    const clearParam = () => {
      const next = new URLSearchParams(params);
      next.delete('highlight');
      setParams(next, { replace: true });
    };

    const tryFlash = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-highlight-id="${CSS.escape(highlightId)}"]`,
      );
      if (el) {
        firedFor.current = highlightId;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('row-flash');
        window.setTimeout(() => el.classList.remove('row-flash'), FLASH_DURATION_MS);
        clearParam();
        return;
      }
      if (Date.now() - started >= RETRY_MAX_MS) {
        // Target not on this page — silent no-op. Clear the param anyway
        // so it doesn't stick in the URL after the user interacts.
        firedFor.current = highlightId;
        clearParam();
        return;
      }
      timerId = window.setTimeout(tryFlash, RETRY_INTERVAL_MS);
    };

    // Defer one tick so the current render commit lands before we query.
    timerId = window.setTimeout(tryFlash, 0);
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
    // We intentionally depend on highlightId + ready only. `params` and
    // `setParams` are stable identities from react-router and re-triggering
    // on their change would cause the hook to re-fire after we strip the
    // param ourselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, ready]);

  const highlightAttrs = (personId: string | undefined | null): Record<string, string> => {
    if (!personId) return {};
    return { 'data-highlight-id': personId };
  };

  return { highlightId, highlightAttrs };
}
