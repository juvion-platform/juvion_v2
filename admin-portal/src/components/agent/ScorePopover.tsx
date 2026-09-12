/** Per-student risk breakdown + lazily-loaded narrative, anchored above the risk badge. */
import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';

import type { RiskScoreResult } from '../../services/finance-agent';
import { useRiskNarrative } from './useAgent';

/**
 * Human-readable tier label for the popover header.
 */
export function tierLabel(tier: RiskScoreResult['tier']): string {
  switch (tier) {
    case 'critical':
      return 'Critical';
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
    case 'insufficient-data':
      return 'Insufficient data';
  }
}
/**
 * Hover popover that surfaces the per-student risk-score breakdown +
 * lazy-loaded LLM narrative. The popover is anchored to the badge via a
 * relative parent + absolute child — no positioning lib needed because
 * the popover is short-lived and only attached to a small badge.
 *
 * The narrative query is lazily enabled — only fires when this component
 * mounts (i.e. only when the user actually hovers the badge for ≥ 300ms,
 * which is when the parent toggles `hovered: true`). React Query dedupes
 * concurrent hovers per studentId via the queryKey.
 */
export function RiskHoverPopover({
  studentId,
  riskScore,
  fetchNarrative,
}: {
  studentId: string;
  riskScore: RiskScoreResult;
  fetchNarrative: boolean;
}) {
  const narrativeQuery = useRiskNarrative(studentId, fetchNarrative);

  // Show only active (non-zero-weight) factors, sorted by absolute weight.
  const activeFactors = useMemo(
    () =>
      [...riskScore.factors]
        .filter((f) => f.weight !== 0)
        .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
    [riskScore.factors],
  );

  const headerLabel = tierLabel(riskScore.tier);

  return (
    <div
      role="tooltip"
      // The popover sits ABOVE the badge to avoid being clipped by the
      // card's bottom edge when the card is the last in the list. min-w
      // keeps it readable; max-w stops over-long narratives from shoving
      // the page wider.
      className="absolute right-0 bottom-full mb-2 z-30 w-72 max-w-xs bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-left"
    >
      <div className="text-xs font-bold text-slate-800 mb-1">
        {riskScore.score === null
          ? `Risk score: \u2014 (${headerLabel})`
          : `Risk score: ${riskScore.score} / 100 (${headerLabel})`}
      </div>

      {/* Narrative section (only meaningful when score isn't null). */}
      {riskScore.score !== null && (
        <div className="text-[11px] text-slate-600 leading-snug mb-2 whitespace-pre-wrap">
          {narrativeQuery.isLoading ? (
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <Loader2 size={11} className="animate-spin" />
              Loading…
            </span>
          ) : narrativeQuery.isError ? (
            <span className="text-slate-400">Narrative unavailable</span>
          ) : narrativeQuery.data ? (
            narrativeQuery.data
          ) : (
            <span className="text-slate-400">Narrative unavailable</span>
          )}
        </div>
      )}

      {/* Factor breakdown. */}
      {activeFactors.length > 0 ? (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Factor breakdown
          </div>
          <div className="border-t border-slate-100">
            {activeFactors.map((f) => (
              <div
                key={f.name}
                className="flex items-center justify-between py-1 text-[11px] border-b border-slate-50 last:border-b-0"
              >
                <span className="text-slate-700 truncate pr-2">{f.name}</span>
                <span
                  className={`font-mono font-semibold ${
                    f.weight > 0
                      ? 'text-red-600'
                      : f.weight < 0
                      ? 'text-emerald-600'
                      : 'text-slate-500'
                  }`}
                >
                  {f.weight > 0 ? `+${f.weight}` : f.weight}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-slate-400">
          No factor breakdown available.
        </div>
      )}
    </div>
  );
}
