import { useEffect } from 'react';
import { ArrowRight, RefreshCcw, Sparkles } from 'lucide-react';

import { getForecastNarrative, type BudgetWarning } from '../../services/finance-agent';
import { formatCachedAt, formatInrCompact } from './format';
import { InlineRetry, LoadingBanner } from './states';
import { agentKeys, useForceRefresh, useForecast } from './useAgent';

/**
 * AI forecast banner.
 *
 * Self-fetching: calls `/juvi/finance-agent/forecast-narrative` on mount
 * (cache 5 min). The backend runs Holt-Winters on the last 180 days of
 * collection sums and asks the LLM for a short driver narrative.
 *
 * Render states:
 *   - loading      → skeleton banner
 *   - success      → range "₹X–Y by month-end (Z% confidence)" + (optional)
 *                    Drivers narrative
 *   - LLM degraded → range only; no Drivers line; no "AI offline" chrome
 *   - error        → small inline "Forecast unavailable" + retry; rest of
 *                    dashboard renders
 *
 * `highRiskCount` / `atRiskAmount` come from the parent's defaulter list
 * (separate query; the banner shouldn't refetch it).
 */
export function AIForecastBanner({
  monthAnchor,
  highRiskCount,
  atRiskAmount,
  onViewRisk,
  degraded = false,
  onWarning,
  on429,
}: {
  monthAnchor: Date;
  highRiskCount: number;
  atRiskAmount: number;
  onViewRisk: () => void;
  /** When true, suppress LLM-narrative copy; deterministic projection stays. */
  degraded?: boolean;
  /** Surface the optional `budgetWarning` payload to the parent dashboard. */
  onWarning?: (w: BudgetWarning | null) => void;
  /** Surface a 429 status from the forecast call to the parent dashboard. */
  on429?: () => void;
}) {
  const query = useForecast(monthAnchor);
  const { run: handleForceRefresh, isRefreshing: isForceRefreshing } = useForceRefresh(
    agentKeys.forecast(monthAnchor.toISOString()),
    () => getForecastNarrative(monthAnchor, true),
  );

  // L7b — bubble `budgetWarning` up to the dashboard so it can hydrate the
  // <BudgetBanner /> from the same payload. Re-fires on every render where
  // the field changes; `useEffect` deps cover the value (or its absence).
  const warningPayload = query.data?.budgetWarning;
  useEffect(() => {
    if (!onWarning) return;
    onWarning(warningPayload ?? null);
  }, [onWarning, warningPayload]);

  // L7b — surface 429 from the forecast call to the parent so the page can
  // flip into degraded mode. Axios stuffs the status under `response.status`.
  const errorStatus =
    (query.error as { response?: { status?: number } } | undefined)?.response
      ?.status;
  useEffect(() => {
    if (errorStatus === 429 && on429) on429();
  }, [errorStatus, on429]);

  if (query.isLoading) {
    return (
      <div className="mb-4">
        <LoadingBanner />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return <InlineRetry label="Forecast unavailable." onRetry={() => query.refetch()} className="mb-4" />;
  }

  const { projection, narrative, cachedAt } = query.data;
  // Degraded mode hides the narrative ("driver text") but keeps the
  // deterministic projection band visible — the numbers don't depend on
  // the LLM and shouldn't disappear when the budget is tight.
  const showNarrative = !degraded && Boolean(narrative);
  const confidencePct = Math.round(projection.confidence * 100);

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-xl px-5 py-4 mb-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white mt-0.5">
          <Sparkles size={16} />
        </div>
        <div className="text-sm text-emerald-900 leading-snug min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              <strong className="font-semibold">AI forecast:</strong>{' '}
              Likely{' '}
              <strong className="font-semibold">
                {formatInrCompact(projection.lower)}–{formatInrCompact(projection.upper)}
              </strong>{' '}
              by month-end{' '}
              <span className="text-emerald-700/70">({confidencePct}% confidence)</span>.
            </span>
            {cachedAt && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700/60 bg-emerald-100/60 px-2 py-0.5 rounded-full">
                Cached · {formatCachedAt(cachedAt)}
              </span>
            )}
          </div>
          {showNarrative && (
            <div className="mt-1.5 text-xs text-emerald-800/90 whitespace-pre-wrap">
              <span className="font-semibold mr-1">{'\u2726'} Drivers:</span>
              {narrative}
            </div>
          )}
          {highRiskCount > 0 && (
            <div className="mt-1.5">
              <strong className="font-semibold">{highRiskCount}</strong> students
              in high-default-risk zone — {formatInrCompact(atRiskAmount)} may need
              escalation.
            </div>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 self-start flex items-center gap-2">
        <button
          type="button"
          onClick={handleForceRefresh}
          disabled={isForceRefreshing}
          title="Refresh forecast"
          aria-label="Refresh forecast"
          className="h-7 w-7 rounded-lg border border-emerald-300 bg-emerald-100/60 hover:bg-emerald-200/60 flex items-center justify-center text-emerald-700 disabled:opacity-50"
        >
          <RefreshCcw
            size={12}
            className={isForceRefreshing ? 'animate-spin' : ''}
          />
        </button>
        <button
          type="button"
          onClick={onViewRisk}
          className="text-xs font-semibold px-3 py-2 rounded-lg bg-gradient-to-br from-blue-600 to-teal-500 text-white hover:shadow-md transition-shadow flex items-center gap-1"
        >
          View risk list
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
