/**
 * FeeDashboardPage (T9 — Fee Collection Analytics & Alerts)
 *
 * Redesigned per the "Juvion — Portal Redesign v2" proposal. AI-forward,
 * action-oriented layout that collapses the previous 5 KPI + 2 chart + 3
 * breakdown grid into a denser, more opinionated view:
 *
 *   Page header (label + month picker + refresh)
 *   AI forecast banner (velocity-based projection of month-end collection)
 *   4 compact stat pills (Collected MTD / Pending / YTD / Overdue >30d)
 *   Students requiring action — risk-sorted cards with inline action buttons
 *   2-col: Collection by programme (horizontal bars) + Payment mode split (progress)
 *
 * Data source unchanged: `GET /finance/analytics/dashboard` + `/defaulters`.
 * The "AI" recommendations per defaulter are currently rule-based placeholders
 * that will become real AI-agent output once that capability lands. Marked
 * with `// v1 rule-based` comments.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCcw,
  Wallet,
  Clock,
  TrendingUp,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Send,
  X,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  FileText,
  Bell,
  PhoneCall,
  BookOpen,
  EyeOff,
  Edit3,
  Check,
  SkipForward,
} from 'lucide-react';

import {
  getDashboard,
  getDefaulters,
  type DashboardV1,
  type DefaulterListItem,
  type PaymentModeKey,
} from '../../services/fee-analytics';
import {
  approveReminderDrafts,
  dismissSituation,
  getForecastNarrative,
  getReminderDrafts,
  getRiskScores,
  getSituations,
  streamQuery,
  type AgentChatFinal,
  type ApprovalResult,
  type ApprovedDraft,
  type BudgetWarning,
  type ForecastWithNarrative,
  type ReminderDraft,
  type RiskScoreResult,
  type RiskScoresResponse,
  type Situation,
  type SituationAction,
  type SituationActionType,
  type SituationsResponse,
} from '../../services/finance-agent';
import BudgetBanner from '../../components/finance/BudgetBanner';
import { useAuthStore } from '../../stores/authStore';

// ── Helpers ───────────────────────────────────────────────────────────

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatInrCompact(value: number | undefined | null): string {
  const v = value ?? 0;
  const abs = Math.abs(v);
  if (abs >= 10_000_000) return `\u20B9${(v / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000) return `\u20B9${(v / 100_000).toFixed(1)}L`;
  if (abs >= 1000) return `\u20B9${(v / 1000).toFixed(1)}K`;
  return `\u20B9${v.toLocaleString('en-IN')}`;
}

function formatInrFull(value: number | undefined | null): string {
  return `\u20B9${(value ?? 0).toLocaleString('en-IN')}`;
}

function formatCachedAt(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function lastOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/**
 * Indian fiscal year starts Apr 1. Given any anchor date, return the April 1st
 * of the FY it belongs to.
 */
function fiscalYearStart(anchor: Date): Date {
  const y = anchor.getMonth() >= 3 ? anchor.getFullYear() : anchor.getFullYear() - 1;
  return new Date(y, 3, 1);
}

/**
 * Rule-based recommendation text for a defaulter. Placeholder until a real
 * AI agent exists — swap the body of this function when that ships.
 */
function aiRecommendation(item: DefaulterListItem): string {
  // v1 rule-based
  if (item.autoEscalationPaused && new Date(item.autoEscalationPaused) > new Date()) {
    const pu = new Date(item.autoEscalationPaused).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    });
    return `Auto-escalation paused until ${pu}`;
  }
  if (item.daysOverdue >= 60) return 'Welfare referral suggested — contact family';
  if (item.daysOverdue >= 30) return 'Parent call + payment plan (2 instalments) recommended';
  if (item.daysOverdue >= 15) return 'Check scholarship eligibility before next escalation';
  if (item.daysOverdue >= 8) return 'Late fee applied — reminder sent';
  if (item.daysOverdue >= 1) return 'First-level reminder dispatched';
  return 'Auto reminder scheduled before due date';
}

/**
 * Risk-score-based styling for a defaulter card. Tiers map to the same
 * thresholds used by the backend's deterministic scorer (risk-scorer.ts),
 * but we also accept `undefined` (scores still loading) and `null`
 * (insufficient data) and render neutral chrome for both.
 *
 *   score ≥ 70  → Critical (red)
 *   score ≥ 40  → High     (amber)
 *   score ≥ 15  → Medium   (slate)
 *   score < 15  → Low      (white/muted)
 *   score null  → Insufficient data (neutral white)
 *   undefined   → Loading  (neutral white) — same chrome as null
 */
function riskTierStyles(score: number | null | undefined): {
  wrap: string;
  amount: string;
  badgeBg: string;
  badgeLabel: string;
} {
  if (score === undefined || score === null) {
    return {
      wrap: 'bg-white border-slate-200',
      amount: 'text-slate-800',
      badgeBg: 'bg-slate-100 text-slate-600',
      badgeLabel: score === null ? '\u2014' : 'Risk',
    };
  }
  if (score >= 70) {
    return {
      wrap: 'bg-red-50 border-red-200',
      amount: 'text-red-700',
      badgeBg: 'bg-red-100 text-red-800',
      badgeLabel: 'Critical',
    };
  }
  if (score >= 40) {
    return {
      wrap: 'bg-amber-50 border-amber-200',
      amount: 'text-amber-700',
      badgeBg: 'bg-amber-100 text-amber-800',
      badgeLabel: 'High',
    };
  }
  if (score >= 15) {
    return {
      wrap: 'bg-slate-50 border-slate-200',
      amount: 'text-slate-800',
      badgeBg: 'bg-slate-200 text-slate-700',
      badgeLabel: 'Medium',
    };
  }
  return {
    wrap: 'bg-white border-slate-200',
    amount: 'text-slate-800',
    badgeBg: 'bg-emerald-100 text-emerald-800',
    badgeLabel: 'Low',
  };
}

/**
 * Human-readable tier label for the popover header.
 */
function tierLabel(tier: RiskScoreResult['tier']): string {
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

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ── Sub-components ────────────────────────────────────────────────────

function MonthStepper({
  anchor,
  onChange,
}: {
  anchor: Date;
  onChange: (d: Date) => void;
}) {
  const goto = (delta: number) => {
    const n = new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
    onChange(n);
  };
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => goto(-1)}
        className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600"
        aria-label="Previous month"
      >
        <ChevronLeft size={16} />
      </button>
      <div className="px-3 text-sm font-semibold text-slate-800 min-w-[140px] text-center">
        {monthLabel(anchor)}
      </div>
      <button
        type="button"
        onClick={() => goto(1)}
        className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600"
        aria-label="Next month"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function StatPill({
  icon,
  value,
  label,
  tone = 'default',
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  tone?: 'default' | 'warn' | 'success';
}) {
  const toneClass =
    tone === 'warn'
      ? 'text-red-700'
      : tone === 'success'
      ? 'text-emerald-700'
      : 'text-slate-900';
  return (
    <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex-shrink-0 text-slate-500">{icon}</div>
      <div className="min-w-0">
        <div className={`text-lg font-extrabold leading-tight ${toneClass}`}>{value}</div>
        <div className="text-xs text-slate-500 truncate">{label}</div>
      </div>
    </div>
  );
}

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
function AIForecastBanner({
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
  const queryClient = useQueryClient();
  const monthAnchorIso = monthAnchor.toISOString();
  const [isForceRefreshing, setIsForceRefreshing] = useState(false);

  const query = useQuery<ForecastWithNarrative>({
    queryKey: ['fee-forecast', monthAnchorIso],
    queryFn: () => getForecastNarrative(monthAnchor),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

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

  const handleForceRefresh = () => {
    setIsForceRefreshing(true);
    getForecastNarrative(monthAnchor, true)
      .then((result) => {
        queryClient.setQueryData<ForecastWithNarrative>(
          ['fee-forecast', monthAnchorIso],
          result,
        );
      })
      .catch(() => {
        void query.refetch();
      })
      .finally(() => setIsForceRefreshing(false));
  };

  if (query.isLoading) {
    return (
      <div className="mb-4">
        <LoadingBanner />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
        <div className="text-xs text-amber-800">
          <Sparkles size={12} className="inline mr-1 -mt-0.5" />
          Forecast unavailable.
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
        >
          Retry
        </button>
      </div>
    );
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
function RiskHoverPopover({
  studentId,
  riskScore,
  fetchNarrative,
}: {
  studentId: string;
  riskScore: RiskScoreResult;
  fetchNarrative: boolean;
}) {
  const narrativeQuery = useQuery<string | null>({
    queryKey: ['risk-narrative', studentId],
    queryFn: async () => {
      const out = await getRiskScores([studentId], true);
      return out.scores[0]?.narrative ?? null;
    },
    enabled: fetchNarrative,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

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

function DefaulterCard({
  item,
  riskScore,
  onOpen,
}: {
  item: DefaulterListItem;
  riskScore?: RiskScoreResult;
  onOpen: (studentId: string) => void;
}) {
  const s = riskTierStyles(riskScore?.score);

  // Hover state — set after a 300ms intent delay (avoids triggering an
  // LLM fetch when the cursor merely passes over the badge). On
  // mouse-leave, both the timer AND the open state are cleared.
  const [hovered, setHovered] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);

  // Don't fetch a narrative when the student has insufficient data —
  // there's nothing meaningful for the LLM to explain.
  const canFetchNarrative =
    !!riskScore && riskScore.score !== null && hovered;

  const onBadgeMouseEnter = (): void => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = window.setTimeout(() => {
      setHovered(true);
      hoverTimerRef.current = null;
    }, 300);
  };

  const onBadgeMouseLeave = (): void => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHovered(false);
  };

  // Cancel any pending hover timer on unmount.
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };
  }, []);

  // Badge text: numeric score, em-dash for null, blank chip while loading.
  const badgeScoreText =
    riskScore === undefined
      ? '…'
      : riskScore.score === null
      ? '\u2014'
      : String(riskScore.score);

  return (
    <div
      className={`flex items-center gap-4 p-3 rounded-xl border ${s.wrap} transition-shadow hover:shadow-sm`}
    >
      <div className="flex-shrink-0 h-9 w-9 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white text-[11px] font-bold">
        {initials(item.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-800 truncate">
          {item.name}{' '}
          <span className="text-xs font-normal text-slate-500">
            · {item.rollNumber} · {item.programmeName}
          </span>
        </div>
        <div className="text-xs text-slate-500 mt-0.5 truncate">
          {formatInrFull(item.overdueAmount)} overdue · {item.daysOverdue} days
          overdue · stage {item.escalationStage.replace('stage_', '').replace('_', ' ')}
        </div>
        <div className="text-xs text-violet-700 mt-1 truncate flex items-center gap-1">
          <Sparkles size={11} className="flex-shrink-0" />
          {aiRecommendation(item)}
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <div className={`text-base font-extrabold ${s.amount}`}>
          {formatInrCompact(item.overdueAmount)}
        </div>
        {/*
          The risk badge is anchored relative — the popover positions
          absolute-to-this. onMouseLeave is mounted on the wrapper so
          users can move from the badge into the popover without it
          snapping shut (popover sits inside the wrapper).
        */}
        <div
          className="relative inline-block mt-1"
          onMouseEnter={onBadgeMouseEnter}
          onMouseLeave={onBadgeMouseLeave}
        >
          <span
            className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-default ${s.badgeBg}`}
            aria-label={`Risk ${badgeScoreText} — ${s.badgeLabel}`}
          >
            Risk {badgeScoreText}
          </span>
          {hovered && riskScore && (
            <RiskHoverPopover
              studentId={item.studentId}
              riskScore={riskScore}
              fetchNarrative={canFetchNarrative}
            />
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onOpen(item.studentId)}
        className="flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-lg bg-gradient-to-br from-blue-600 to-teal-500 text-white hover:shadow-md transition-shadow"
      >
        Open
      </button>
    </div>
  );
}

const CATEGORY_COLORS = [
  '#2B6CB0', // blue
  '#38B2AC', // teal
  '#6366F1', // indigo
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EC4899', // pink
  '#8B5CF6', // purple
];

function CollectionByProgrammeCard({ data }: { data: DashboardV1['dueByProgramme'] }) {
  const rows = [...data].sort((a, b) => b.collected - a.collected).slice(0, 7);
  const max = Math.max(1, ...rows.map((r) => r.collected));
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-bold text-slate-800">Collection by programme</div>
          <div className="text-xs text-slate-500">Top 7 by amount collected</div>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-slate-400 py-8 text-center">
          No programme breakdown for this period.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r, i) => {
            const pct = (r.collected / max) * 100;
            const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
            return (
              <div key={r.programmeId} className="flex items-center gap-2">
                <div className="w-20 text-xs text-slate-600 text-right truncate">
                  {r.programmeName}
                </div>
                <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
                <div className="w-16 text-xs font-semibold text-slate-700 text-right">
                  {formatInrCompact(r.collected)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const PAYMENT_MODE_LABEL: Record<PaymentModeKey, string> = {
  upi: 'UPI',
  neft: 'NEFT',
  card: 'Card',
  cash: 'Cash',
  cheque: 'Cheque / DD',
  online: 'Other online',
  other: 'Other',
};
const PAYMENT_MODE_COLOR: Record<PaymentModeKey, string> = {
  upi: '#38B2AC',
  neft: '#2B6CB0',
  card: '#6366F1',
  cash: '#F59E0B',
  cheque: '#8B5CF6',
  online: '#10B981',
  other: '#94A3B8',
};

function PaymentModeCard({
  data,
}: {
  data: DashboardV1['paymentModeBreakdown'];
}) {
  const entries = (Object.entries(data) as Array<[PaymentModeKey, number]>)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-bold text-slate-800">Payment mode split</div>
          <div className="text-xs text-slate-500">Share of this month's collection</div>
        </div>
      </div>
      {total === 0 ? (
        <div className="text-xs text-slate-400 py-8 text-center">
          No payments recorded in this period.
        </div>
      ) : (
        <div className="flex flex-col gap-3 mt-2">
          {entries.map(([mode, amt]) => {
            const pct = (amt / total) * 100;
            return (
              <div key={mode}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-700">{PAYMENT_MODE_LABEL[mode]}</span>
                  <span className="font-semibold text-slate-800">
                    {pct.toFixed(0)}% · {formatInrCompact(amt)}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: PAYMENT_MODE_COLOR[mode] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── AI command bar + chat thread ──────────────────────────────────────

/**
 * Message in the chat thread. `pending` is set while streaming; cleared on
 * the `done` event. `final` carries provider/model/usage metadata used in
 * the small footer line under the assistant bubble. `error` is set when
 * the stream produced an error variant (HTTP, parse, or connection drop).
 */
interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  pending?: boolean;
  final?: AgentChatFinal;
  error?: boolean;
}

const CHAT_SUGGESTIONS = [
  'Show fee defaulters this month',
  'Draft a fee reminder for overdue parents',
  "Who is at risk of default next week?",
  'Summarize March collection performance',
];

/**
 * Friendly, status-aware error text for an HTTP failure from the SSE
 * endpoint. Mirrors the spec's degraded-path UX requirements.
 */
function errorMessageForStatus(status: number | undefined, fallback: string): string {
  if (status === 429) return 'Slow down — try again in a minute.';
  if (status === 503) return 'AI assistant is temporarily unavailable.';
  if (status === 401) return 'Session expired — please log in again.';
  if (status === 403) return "You don't have access to the AI assistant.";
  return fallback || 'AI assistant is temporarily unavailable.';
}

/**
 * AI command bar + inline chat thread. Streams responses live from the
 * backend `/api/juvi/finance-agent/query` SSE endpoint via `streamQuery()`.
 *
 * UX:
 *   - Always-visible compact bar with ✦ icon + input + ⌘K hint + suggestion chips
 *   - Focus or submit opens an inline thread panel below the bar
 *   - ⌘K / Ctrl+K anywhere on the page focuses the input
 *   - Esc blurs the input; if a stream is in flight, also aborts it
 *   - Close button in the thread header collapses + cancels in-flight streams
 *
 * State:
 *   - `conversationId` is persisted to localStorage per college so chat
 *     history survives page reloads (the backend keeps the last 10 turns).
 *   - The active AbortController is held in a ref and torn down on
 *     unmount or when the user clears the thread.
 */
function AICommandBar({ degraded = false }: { degraded?: boolean }) {
  const collegeId = useAuthStore((s) => s.collegeId);
  const convoStorageKey = collegeId ? `finance-agent-convo:${collegeId}` : null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(() => {
    if (!convoStorageKey) return undefined;
    return localStorage.getItem(convoStorageKey) ?? undefined;
  });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cmd/Ctrl+K focuses the input from anywhere on the page.
  // Esc blurs the input AND aborts any in-flight stream.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        if (document.activeElement === inputRef.current) {
          inputRef.current?.blur();
        }
        if (abortRef.current && !abortRef.current.signal.aborted) {
          abortRef.current.abort();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  // Auto-scroll the thread to the newest message.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Abort any in-flight stream when the component unmounts.
  useEffect(() => {
    return () => {
      if (abortRef.current && !abortRef.current.signal.aborted) {
        abortRef.current.abort();
      }
    };
  }, []);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Cancel any prior stream before starting a new one.
    if (abortRef.current && !abortRef.current.signal.aborted) {
      abortRef.current.abort();
    }
    const ac = new AbortController();
    abortRef.current = ac;

    const userMsgId = `u-${Date.now()}`;
    const pendingMsgId = `a-${Date.now() + 1}`;
    const userMsg: ChatMessage = { id: userMsgId, role: 'user', text: trimmed };
    const pendingMsg: ChatMessage = {
      id: pendingMsgId,
      role: 'ai',
      text: '',
      pending: true,
    };
    setMessages((m) => [...m, userMsg, pendingMsg]);
    setInput('');
    setIsOpen(true);

    try {
      for await (const evt of streamQuery({
        prompt: trimmed,
        conversationId,
        signal: ac.signal,
      })) {
        if (evt.type === 'delta') {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === pendingMsgId
                ? { ...msg, text: msg.text + evt.text, pending: true }
                : msg,
            ),
          );
        } else if (evt.type === 'done') {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === pendingMsgId
                ? { ...msg, pending: false, final: evt.final }
                : msg,
            ),
          );
          if (evt.final.conversationId) {
            setConversationId(evt.final.conversationId);
            if (convoStorageKey) {
              localStorage.setItem(convoStorageKey, evt.final.conversationId);
            }
          }
        } else if (evt.type === 'error') {
          // If we got an error AFTER deltas, keep the partial text and
          // append a "(connection lost)" suffix; otherwise replace the
          // pending bubble with a friendly status-specific message.
          setMessages((m) =>
            m.map((msg) => {
              if (msg.id !== pendingMsgId) return msg;
              if (msg.text && evt.error === 'connection lost') {
                return {
                  ...msg,
                  text: `${msg.text} (connection lost)`,
                  pending: false,
                  error: true,
                };
              }
              return {
                ...msg,
                text: errorMessageForStatus(evt.status, evt.error),
                pending: false,
                error: true,
              };
            }),
          );
        }
      }
    } catch (e) {
      // AbortError is expected when the user cancels; surface only the
      // partial text in that case.
      if (e instanceof Error && e.name === 'AbortError') {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === pendingMsgId
              ? {
                  ...msg,
                  text: msg.text ? `${msg.text} (cancelled)` : 'Cancelled.',
                  pending: false,
                  error: true,
                }
              : msg,
          ),
        );
      } else {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === pendingMsgId
              ? {
                  ...msg,
                  text: 'AI assistant is temporarily unavailable.',
                  pending: false,
                  error: true,
                }
              : msg,
          ),
        );
      }
    } finally {
      if (abortRef.current === ac) {
        abortRef.current = null;
      }
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const clear = () => {
    if (abortRef.current && !abortRef.current.signal.aborted) {
      abortRef.current.abort();
    }
    setMessages([]);
    setIsOpen(false);
    setInput('');
  };

  return (
    <div className="mb-4">
      {/* Command bar */}
      <div
        className={`bg-white border rounded-2xl transition-shadow ${
          isOpen
            ? 'border-violet-300 shadow-[0_0_0_2px_rgba(139,92,246,0.12),0_4px_20px_rgba(139,92,246,0.1)]'
            : 'border-violet-200 shadow-[0_0_0_1px_rgba(139,92,246,0.08),0_2px_10px_rgba(139,92,246,0.05)]'
        }`}
      >
        <form onSubmit={onSubmit} className="flex items-center gap-3 px-4 py-3">
          <div className="flex-shrink-0 h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
            <Sparkles size={14} />
          </div>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={
              degraded
                ? 'AI assistant disabled — weekly budget exceeded.'
                : 'Ask anything or give a command — "show fee defaulters", "draft reminder", "who is at risk"…'
            }
            disabled={degraded}
            aria-disabled={degraded}
            className="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
          />
          {input.trim() ? (
            <button
              type="submit"
              aria-label="Send"
              disabled={degraded}
              className="flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white flex items-center justify-center hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={14} />
            </button>
          ) : (
            <kbd className="flex-shrink-0 text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
              ⌘K
            </kbd>
          )}
        </form>
        {/* Suggestion chips — hidden in degraded mode (no calls allowed). */}
        {!degraded && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-3 border-t border-slate-50 pt-2">
            {CHAT_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="text-[11px] font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Inline chat thread */}
      {isOpen && messages.length > 0 && (
        <div className="mt-2 bg-white border border-slate-200 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
                <Sparkles size={11} />
              </div>
              <div className="text-xs font-semibold text-slate-700">
                Finance AI assistant
              </div>
              <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">
                Preview
              </span>
            </div>
            <button
              type="button"
              onClick={clear}
              aria-label="Clear conversation"
              className="h-6 w-6 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
            >
              <X size={14} />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] bg-gradient-to-br from-blue-600 to-teal-500 text-white text-sm rounded-2xl rounded-br-sm px-3.5 py-2">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex flex-col">
                  <div className="flex justify-start gap-2">
                    <div className="flex-shrink-0 h-6 w-6 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white mt-0.5">
                      <Sparkles size={11} />
                    </div>
                    <div
                      className={`max-w-[80%] text-sm rounded-2xl rounded-bl-sm px-3.5 py-2 border whitespace-pre-wrap ${
                        m.error
                          ? 'bg-red-50 text-red-800 border-red-200'
                          : 'bg-slate-50 text-slate-800 border-slate-100'
                      }`}
                    >
                      {m.pending && !m.text ? (
                        <span className="inline-flex items-center gap-2 text-slate-500">
                          <Loader2 size={12} className="animate-spin" />
                          Thinking…
                        </span>
                      ) : (
                        <>
                          {m.text}
                          {m.pending && (
                            <span className="inline-block ml-1 w-1.5 h-3 bg-slate-400 align-middle animate-pulse" />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {m.final && !m.error && (
                    <div className="text-[10px] text-slate-400 mt-1 ml-8">
                      {`\u2726 ${m.final.provider} \u00B7 ${m.final.model} \u00B7 ${(
                        m.final.durationMs / 1000
                      ).toFixed(1)}s \u00B7 ${m.final.inputTokens}\u2192${
                        m.final.outputTokens
                      } tokens`}
                    </div>
                  )}
                </div>
              ),
            )}
            <div ref={threadEndRef} />
          </div>
          <div className="px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400">
            Powered by the Juvion Finance AI agent. Conversation context is kept
            on this device per college; press Esc to cancel a streaming reply.
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingBanner() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
      <div className="h-3 bg-slate-200 rounded w-2/3" />
    </div>
  );
}

function ErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
      <div className="text-sm text-red-700">Failed to load dashboard data.</div>
      <button
        onClick={onRetry}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white"
      >
        Retry
      </button>
    </div>
  );
}

// ── Situation cards (A9) ──────────────────────────────────────────────

/**
 * Lightweight inline toast — fixed top-right, auto-dismiss after a short
 * timeout. We avoid the existing `InlineToast` from FinancialHoldsPage
 * because that component is page-local; pulling it into a shared module is
 * out of scope for A9. The footprint here is intentionally tiny.
 */
interface SituationToastState {
  kind: 'success' | 'info' | 'error';
  message: string;
}

function SituationToast({
  toast,
  onDismiss,
}: {
  toast: SituationToastState | null;
  onDismiss: () => void;
}) {
  // Auto-dismiss after 3.5s. The effect resets when a new toast comes in.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(onDismiss, 3500);
    return () => window.clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;
  const cls =
    toast.kind === 'success'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
      : toast.kind === 'error'
      ? 'bg-red-50 border-red-200 text-red-800'
      : 'bg-violet-50 border-violet-200 text-violet-800';
  const Icon =
    toast.kind === 'success'
      ? CheckCircle2
      : toast.kind === 'error'
      ? ShieldAlert
      : Sparkles;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 right-4 z-[60] max-w-sm rounded-lg border px-4 py-3 shadow-lg ${cls}`}
    >
      <div className="flex items-start gap-2">
        <Icon size={16} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1 text-sm font-medium">{toast.message}</div>
        <button
          type="button"
          onClick={onDismiss}
          className="p-0.5 rounded hover:bg-black/5"
          aria-label="Dismiss notification"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

/**
 * Severity-driven styling for a Situation card. The border-left ring is
 * the signal — body chrome stays muted so 5 cards in a row don't drown
 * out the rest of the dashboard.
 */
function situationCardStyle(severity: Situation['severity']): string {
  if (severity === 'high') {
    return 'border-l-4 border-l-red-500 bg-red-50/50 border border-red-100';
  }
  if (severity === 'medium') {
    return 'border-l-4 border-l-amber-500 bg-amber-50/50 border border-amber-100';
  }
  return 'border-l-4 border-l-slate-400 bg-slate-50 border border-slate-200';
}

const SITUATION_ACTION_ICON: Record<SituationActionType, React.ComponentType<{ size?: number; className?: string }>> = {
  draft_plan: FileText,
  draft_reminder: Bell,
  schedule_call: PhoneCall,
  review_policy: BookOpen,
  dismiss: EyeOff,
};

/**
 * Default human-readable labels for each action type — used as a fallback
 * when the LLM omits the `label` field. The orchestrator usually provides
 * one but defence in depth is cheap.
 */
const SITUATION_ACTION_DEFAULT_LABEL: Record<SituationActionType, string> = {
  draft_plan: 'Draft plan',
  draft_reminder: 'Draft reminder',
  schedule_call: 'Schedule call',
  review_policy: 'Review policy',
  dismiss: 'Dismiss',
};

/**
 * "Coming soon" toast text per action type for the actions that aren't
 * wired in this sprint (per A9 spec — only `draft_reminder` flows through
 * to A10's panel; `dismiss` opens the local dialog).
 */
const SITUATION_ACTION_COMING_SOON: Partial<Record<SituationActionType, string>> = {
  draft_plan: 'Plan builder coming soon',
  schedule_call: 'Calendar integration coming soon',
  review_policy: 'Policy retrieval coming soon',
};

/**
 * Snooze choices for the dismiss dialog. 7 days is the spec default.
 */
const SNOOZE_OPTIONS: ReadonlyArray<{ value: 1 | 3 | 7 | 30; label: string }> = [
  { value: 1, label: '1 day' },
  { value: 3, label: '3 days' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
];

/**
 * Inline modal for dismissing (snoozing) a situation. Anchored to the
 * page (fixed inset) rather than the card to avoid clipping at card edges.
 * Renders only while `open` is true; the parent owns the open state.
 */
function DismissSituationDialog({
  situation,
  onClose,
  onConfirm,
  isSubmitting,
}: {
  situation: Situation;
  onClose: () => void;
  onConfirm: (snoozeDays: 1 | 3 | 7 | 30, reason: string) => void;
  isSubmitting: boolean;
}) {
  const [snoozeDays, setSnoozeDays] = useState<1 | 3 | 7 | 30>(7);
  const [reason, setReason] = useState('');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dismiss-situation-title"
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/30 px-4"
      // Backdrop click closes the dialog (only when not submitting).
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5">
        <div className="flex items-start justify-between mb-3">
          <h3
            id="dismiss-situation-title"
            className="text-sm font-bold text-slate-800"
          >
            Dismiss situation
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="p-0.5 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-50"
          >
            <X size={14} />
          </button>
        </div>
        <p className="text-xs text-slate-600 mb-3 line-clamp-2">
          {situation.title}
        </p>
        <div className="mb-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Snooze for
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SNOOZE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer transition-colors ${
                  snoozeDays === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="snooze-days"
                  value={opt.value}
                  checked={snoozeDays === opt.value}
                  onChange={() => setSnoozeDays(opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <label
            htmlFor="dismiss-reason"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
          >
            Reason <span className="font-normal lowercase text-slate-400">(optional)</span>
          </label>
          <textarea
            id="dismiss-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you dismissing this? (optional)"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none resize-none"
          />
          <div className="text-[10px] text-slate-400 mt-1 text-right">
            {reason.length} / 500
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(snoozeDays, reason.trim())}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <EyeOff size={13} />
            )}
            {isSubmitting ? 'Dismissing…' : 'Dismiss situation'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One Situation card. Action buttons render in a footer row; the list is
 * deduped (so two `dismiss` actions from the LLM don't both render — only
 * one ghost `[Dismiss]` ever appears, which we always inject regardless of
 * what the LLM included).
 */
function SituationCard({
  situation,
  onAction,
  onDismissClick,
}: {
  situation: Situation;
  onAction: (action: SituationAction) => void;
  onDismissClick: () => void;
}) {
  // Drop any LLM-emitted dismiss actions — we render our own ghost dismiss
  // button at the end of the row regardless. Other action types are
  // deduped by `type` so the row stays compact even if the LLM emits two
  // (e.g. two `draft_reminder` entries with different payloads).
  const visibleActions = useMemo(() => {
    const seen = new Set<SituationActionType>();
    const out: SituationAction[] = [];
    for (const a of situation.actions) {
      if (a.type === 'dismiss') continue;
      if (seen.has(a.type)) continue;
      seen.add(a.type);
      out.push(a);
    }
    return out;
  }, [situation.actions]);

  return (
    <div
      className={`flex flex-col rounded-xl p-3.5 transition-shadow hover:shadow-sm ${situationCardStyle(situation.severity)}`}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <Sparkles
          size={13}
          className="flex-shrink-0 mt-0.5 text-violet-500"
          aria-hidden
        />
        <div className="text-[15px] font-bold text-slate-800 leading-snug">
          {situation.title}
        </div>
      </div>
      <p
        className="text-sm text-slate-600 leading-snug mb-3 overflow-hidden"
        style={{
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 3,
        }}
      >
        {situation.narrative}
      </p>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-2 border-t border-black/5">
        {visibleActions.map((action) => {
          const Icon = SITUATION_ACTION_ICON[action.type];
          const label =
            action.label || SITUATION_ACTION_DEFAULT_LABEL[action.type];
          return (
            <button
              key={action.type}
              type="button"
              onClick={() => onAction(action)}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 inline-flex items-center gap-1 transition-colors"
            >
              <Icon size={11} />
              {label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onDismissClick}
          className="ml-auto text-[11px] font-semibold px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1 transition-colors"
        >
          <EyeOff size={11} />
          Dismiss
        </button>
      </div>
    </div>
  );
}

/**
 * Skeleton card shown while the situations query is in flight. Three of
 * these render in a row to hint at the eventual layout.
 */
function SituationCardSkeleton() {
  return (
    <div className="border-l-4 border-l-slate-200 bg-slate-50 border border-slate-200 rounded-xl p-3.5 animate-pulse">
      <div className="h-3.5 bg-slate-200 rounded w-2/3 mb-2" />
      <div className="h-3 bg-slate-200 rounded w-full mb-1.5" />
      <div className="h-3 bg-slate-200 rounded w-5/6 mb-1.5" />
      <div className="h-3 bg-slate-200 rounded w-3/4 mb-3" />
      <div className="flex gap-1.5">
        <div className="h-6 w-20 bg-slate-200 rounded-lg" />
        <div className="h-6 w-24 bg-slate-200 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * "Agent findings" — a row of LLM-picked situation cards above the
 * defaulter list. Self-fetches `/situations` (5min stale time per spec).
 *
 * `onDraftReminder` is the seam for A10's reminder-drafts panel — when
 * that lands the parent will pass a real handler. For now A9 just shows a
 * brief toast "Drafting reminders for N students…" so the click is
 * never silent.
 *
 * Render states:
 *   - loading      → 3 skeleton cards
 *   - empty        → muted message "No situations need attention…"
 *                    (delayed 500ms to avoid flash on quick loads)
 *   - error        → inline amber banner + retry button. Dashboard
 *                    continues rendering — agent offline must NOT block
 *                    the rest of the page.
 *   - success      → up to 5 cards in a 1/2/3-col responsive grid.
 */
function SituationCards({
  onDraftReminder,
  degraded = false,
}: {
  onDraftReminder?: (studentIds: string[]) => void;
  /** When true, the entire panel is hidden — situations are LLM-derived. */
  degraded?: boolean;
}) {
  const queryClient = useQueryClient();
  const query = useQuery<SituationsResponse>({
    queryKey: ['situations'],
    queryFn: () => getSituations(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: !degraded,
  });

  // L7b — degraded mode (e.g. weekly LLM budget hit) hides this panel
  // entirely. `enabled: !degraded` above also stops the network call.
  if (degraded) return null;

  const [toast, setToast] = useState<SituationToastState | null>(null);
  const [dismissTarget, setDismissTarget] = useState<Situation | null>(null);
  const [isDismissSubmitting, setIsDismissSubmitting] = useState(false);
  const [isForceRefreshing, setIsForceRefreshing] = useState(false);

  // Empty-state delay: avoid flashing the empty message on quick loads.
  // We only show the empty message after 500ms of "no data" — by which
  // point the user already sees the section header so the absence of
  // cards doesn't feel like a layout glitch.
  const [showEmpty, setShowEmpty] = useState(false);
  useEffect(() => {
    if (query.isSuccess && (query.data?.situations.length ?? 0) === 0) {
      const t = window.setTimeout(() => setShowEmpty(true), 500);
      return () => window.clearTimeout(t);
    }
    setShowEmpty(false);
    return undefined;
  }, [query.isSuccess, query.data]);

  const refresh = () => {
    setIsForceRefreshing(true);
    getSituations(true)
      .then((result) => {
        queryClient.setQueryData<SituationsResponse>(['situations'], result);
      })
      .catch(() => {
        void queryClient.invalidateQueries({ queryKey: ['situations'] });
      })
      .finally(() => setIsForceRefreshing(false));
  };

  const handleAction = (situation: Situation, action: SituationAction) => {
    if (action.type === 'draft_reminder') {
      const ids = situation.studentIds;
      const count = ids.length;
      setToast({
        kind: 'info',
        message: count > 0
          ? `Drafting reminders for ${count} student${count === 1 ? '' : 's'}…`
          : 'Drafting reminders…',
      });
      if (onDraftReminder) onDraftReminder(ids);
      else {
        // No-op until A10 wires the panel — log so devs notice during dev.
        // eslint-disable-next-line no-console
        console.info(
          '[situations] draft_reminder click (A10 panel not yet wired)',
          { situationId: situation.id, studentIds: ids },
        );
      }
      return;
    }
    const comingSoon = SITUATION_ACTION_COMING_SOON[action.type];
    if (comingSoon) {
      setToast({ kind: 'info', message: comingSoon });
      return;
    }
    // Fallback (e.g. action.type === 'dismiss' shouldn't reach here because
    // the card always uses our local Dismiss button — but guard anyway).
    if (action.type === 'dismiss') {
      setDismissTarget(situation);
    }
  };

  const handleDismissConfirm = async (
    snoozeDays: 1 | 3 | 7 | 30,
    reason: string,
  ) => {
    if (!dismissTarget) return;
    setIsDismissSubmitting(true);
    try {
      await dismissSituation(dismissTarget.fingerprint, snoozeDays, reason);
      setToast({
        kind: 'success',
        message: `Dismissed for ${snoozeDays} day${snoozeDays === 1 ? '' : 's'}`,
      });
      setDismissTarget(null);
      // Refetch so the dismissed card disappears immediately.
      void queryClient.invalidateQueries({ queryKey: ['situations'] });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to dismiss situation';
      setToast({ kind: 'error', message: msg });
    } finally {
      setIsDismissSubmitting(false);
    }
  };

  // Render the section header once and let the body change based on state.
  // This keeps the visual anchor stable while the cards load/empty/error.
  return (
    <section className="mb-4" aria-labelledby="agent-findings-heading">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-violet-500" aria-hidden />
          <h2
            id="agent-findings-heading"
            className="text-sm font-bold text-slate-800"
          >
            Agent findings
          </h2>
          <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">
            Preview
          </span>
        </div>
        <div className="flex items-center gap-2">
          {query.data?.cachedAt && (
            <span className="text-[10px] font-medium text-violet-600/60 bg-violet-50 px-2 py-0.5 rounded-full">
              Cached · {formatCachedAt(query.data.cachedAt)}
            </span>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={query.isFetching || isForceRefreshing}
            aria-label="Refresh agent findings"
            title="Refresh"
            className="h-7 w-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 disabled:opacity-50"
          >
            <RefreshCcw
              size={12}
              className={query.isFetching || isForceRefreshing ? 'animate-spin' : ''}
            />
          </button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <SituationCardSkeleton />
          <SituationCardSkeleton />
          <SituationCardSkeleton />
        </div>
      ) : query.isError ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-xs text-amber-800 flex items-center gap-1.5">
            <Sparkles size={12} aria-hidden />
            Agent findings unavailable.
          </div>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
          >
            Retry
          </button>
        </div>
      ) : (query.data?.situations.length ?? 0) === 0 ? (
        showEmpty ? (
          <div className="text-xs text-slate-500 italic px-1 transition-opacity duration-300">
            No situations need attention — collection is clean.
          </div>
        ) : (
          // Reserve a small height while the empty-state delay runs to
          // avoid layout shift when the message finally fades in.
          <div className="h-5" aria-hidden />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(query.data?.situations ?? []).slice(0, 5).map((s) => (
            <SituationCard
              key={s.id}
              situation={s}
              onAction={(a) => handleAction(s, a)}
              onDismissClick={() => setDismissTarget(s)}
            />
          ))}
        </div>
      )}

      {dismissTarget && (
        <DismissSituationDialog
          situation={dismissTarget}
          onClose={() => !isDismissSubmitting && setDismissTarget(null)}
          onConfirm={handleDismissConfirm}
          isSubmitting={isDismissSubmitting}
        />
      )}

      <SituationToast toast={toast} onDismiss={() => setToast(null)} />
    </section>
  );
}

// ── Reminder drafts side panel (A10) ─────────────────────────────────

/**
 * Per-card local status — the panel keeps draft status in memory until
 * the Officer clicks Approve or Skip. Approve auto-dispatches via the
 * `/reminder-drafts/approve` endpoint per spec ("on approve: POST /approve").
 */
type DraftStatus = 'pending' | 'approved' | 'skipped';

/**
 * Tone-pill colour mapping. Soft = teal (default reminder tone),
 * Firm = amber (escalation), Empathetic = violet (welfare-flagged).
 */
function tonePillStyle(tone: ReminderDraft['tone']): string {
  if (tone === 'soft') return 'bg-teal-100 text-teal-800';
  if (tone === 'firm') return 'bg-amber-100 text-amber-800';
  return 'bg-violet-100 text-violet-800';
}

/**
 * Predicted-read-rate badge style. Green if >= 0.7 (the
 * `[Approve recommended]` threshold), amber 0.5-0.7, red < 0.5.
 */
function readRateBadgeStyle(rate: number): string {
  if (rate >= 0.7) return 'bg-emerald-100 text-emerald-800';
  if (rate >= 0.5) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

/**
 * Human-readable label for an ISO 639-1 language code emitted by the
 * orchestrator. Falls back to the upper-cased code (e.g. `'fr'` → `FR`)
 * if the language is unknown — better than a blank pill.
 */
function languageLabel(code: string): string {
  const map: Record<string, string> = {
    en: 'English',
    te: 'Telugu',
    hi: 'Hindi',
    ta: 'Tamil',
    kn: 'Kannada',
    ml: 'Malayalam',
    mr: 'Marathi',
    bn: 'Bengali',
    gu: 'Gujarati',
    pa: 'Punjabi',
    or: 'Odia',
    ur: 'Urdu',
  };
  return map[code.toLowerCase()] ?? code.toUpperCase();
}

/**
 * One row in the panel — a single LLM-drafted reminder for one student.
 * Cards default to read-only; clicking `[Edit]` toggles inputs editable
 * and the same button becomes `[Save]` (which commits the local edit so
 * subsequent Approve uses the new content).
 */
function ReminderDraftCard({
  draft,
  defaulter,
  status,
  edited,
  onApprove,
  onSkip,
  onSaveEdit,
}: {
  draft: ReminderDraft;
  defaulter: DefaulterListItem | undefined;
  status: DraftStatus;
  edited: { subject: string; body: string } | undefined;
  onApprove: () => void;
  onSkip: () => void;
  onSaveEdit: (subject: string, body: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localSubject, setLocalSubject] = useState(edited?.subject ?? draft.subject);
  const [localBody, setLocalBody] = useState(edited?.body ?? draft.body);

  const dim = status !== 'pending';
  const subject = edited?.subject ?? draft.subject;
  const body = edited?.body ?? draft.body;
  const readRatePct = Math.round(draft.predictedReadRate * 100);
  const studentName = defaulter?.name ?? `Student ${draft.studentId.slice(-4)}`;
  const studentRoll = defaulter?.rollNumber ?? '—';
  const programme = defaulter?.programmeName ?? '';

  const handleEditToggle = () => {
    if (isEditing) {
      // Save: commit the local content + flip back to read-only.
      onSaveEdit(localSubject, localBody);
      setIsEditing(false);
    } else {
      // Enter edit mode: seed locals from the current (possibly edited) values.
      setLocalSubject(subject);
      setLocalBody(body);
      setIsEditing(true);
    }
  };

  return (
    <div
      className={`rounded-xl border p-3.5 transition-opacity ${
        dim
          ? 'bg-slate-50 border-slate-200 opacity-60'
          : 'bg-white border-slate-200'
      }`}
    >
      {/* Top row — student identity + overdue context */}
      <div className="flex items-start gap-3 mb-2">
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white text-[11px] font-bold">
          {initials(studentName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800 truncate">
            {studentName}
            <span className="text-xs font-normal text-slate-500 ml-1.5">
              · {studentRoll}
              {programme ? ` · ${programme}` : ''}
            </span>
          </div>
          {defaulter && (
            <div className="text-[11px] text-slate-500 mt-0.5">
              {formatInrFull(defaulter.overdueAmount)} overdue ·{' '}
              {defaulter.daysOverdue} days
            </div>
          )}
        </div>
        {status === 'approved' && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            <Check size={10} />
            Approved
          </span>
        )}
        {status === 'skipped' && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
            <SkipForward size={10} />
            Skipped
          </span>
        )}
      </div>

      {/* Tone + language + read-rate pills */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
          {languageLabel(draft.language)}
        </span>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${tonePillStyle(
            draft.tone,
          )}`}
        >
          {draft.tone} tone
        </span>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${readRateBadgeStyle(
            draft.predictedReadRate,
          )}`}
        >
          {readRatePct}% predicted read-rate
        </span>
      </div>

      {/* Subject */}
      <div className="mb-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
          Subject
        </label>
        <input
          type="text"
          value={isEditing ? localSubject : subject}
          onChange={(e) => setLocalSubject(e.target.value)}
          readOnly={!isEditing}
          disabled={dim}
          className={`w-full px-3 py-1.5 text-sm border rounded-lg outline-none ${
            isEditing
              ? 'border-blue-300 bg-white focus:ring-2 focus:ring-blue-200'
              : 'border-slate-200 bg-slate-50 cursor-default'
          }`}
        />
      </div>

      {/* Body */}
      <div className="mb-2.5">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
          Body
        </label>
        <textarea
          rows={5}
          value={isEditing ? localBody : body}
          onChange={(e) => setLocalBody(e.target.value)}
          readOnly={!isEditing}
          disabled={dim}
          className={`w-full px-3 py-2 text-sm border rounded-lg outline-none resize-y ${
            isEditing
              ? 'border-blue-300 bg-white focus:ring-2 focus:ring-blue-200'
              : 'border-slate-200 bg-slate-50 cursor-default'
          }`}
        />
      </div>

      {/* Action row */}
      {!dim && (
        <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100">
          <button
            type="button"
            onClick={onApprove}
            disabled={isEditing}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            <Check size={11} />
            Approve
          </button>
          <button
            type="button"
            onClick={handleEditToggle}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1"
          >
            {isEditing ? (
              <>
                <Check size={11} />
                Save
              </>
            ) : (
              <>
                <Edit3 size={11} />
                Edit
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={isEditing}
            className="ml-auto text-[11px] font-semibold px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            <SkipForward size={11} />
            Skip
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Skeleton card shown while the drafts query is in flight. Three of these
 * render in a column to hint at the eventual layout.
 */
function ReminderDraftSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 animate-pulse">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-8 w-8 rounded-full bg-slate-200" />
        <div className="flex-1">
          <div className="h-3 bg-slate-200 rounded w-2/3 mb-1.5" />
          <div className="h-2.5 bg-slate-200 rounded w-1/2" />
        </div>
      </div>
      <div className="flex gap-1.5 mb-2.5">
        <div className="h-4 w-16 bg-slate-200 rounded-full" />
        <div className="h-4 w-20 bg-slate-200 rounded-full" />
        <div className="h-4 w-24 bg-slate-200 rounded-full" />
      </div>
      <div className="h-7 bg-slate-100 rounded-lg mb-2" />
      <div className="h-20 bg-slate-100 rounded-lg" />
    </div>
  );
}

/**
 * Right-docked side panel that lets the Finance Officer review LLM-drafted
 * reminders for a list of defaulters and approve them individually or in
 * bulk. Approval auto-dispatches via `/reminder-drafts/approve` per spec
 * ("on approve: POST /approve") and surfaces the 5-min recall hint in the
 * success toast.
 *
 * The panel is conditionally rendered (mounts only when `open || closing`),
 * with a `translate-x-full` → `translate-x-0` transition for the slide-in.
 * Closing flips the transform back and unmounts after 200ms so the slide-out
 * animation actually plays.
 *
 * Accessibility:
 *  - role="dialog" + aria-modal on the panel container
 *  - Esc key closes the panel
 *  - Backdrop click closes the panel
 *  - Focus moves to the close button on open (basic focus management; we
 *    don't pull in focus-trap-react per scope)
 */
function ReminderDraftsPanel({
  open,
  studentIds,
  defaultersById,
  onClose,
}: {
  open: boolean;
  studentIds: string[];
  defaultersById: Map<string, DefaulterListItem>;
  onClose: () => void;
}) {
  // Mount/unmount with a 200ms close-animation buffer so the slide-out
  // transition actually plays. `mounted` controls render presence;
  // `entered` controls the translate (open vs slid-out).
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Next tick: trigger the enter transform.
      const t = window.setTimeout(() => setEntered(true), 10);
      return () => window.clearTimeout(t);
    }
    setEntered(false);
    const t = window.setTimeout(() => setMounted(false), 200);
    return () => window.clearTimeout(t);
  }, [open]);

  // Move focus to the close button when the panel opens (basic focus mgmt).
  useEffect(() => {
    if (entered) closeButtonRef.current?.focus();
  }, [entered]);

  // Esc closes the panel (handled at window level so the listener doesn't
  // need an explicit focused element).
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Local UI state — keyed by studentId so panel re-opens with a new set of
  // ids start fresh.
  const [statuses, setStatuses] = useState<Map<string, DraftStatus>>(new Map());
  const [edits, setEdits] = useState<
    Map<string, { subject: string; body: string }>
  >(new Map());
  const [toast, setToast] = useState<SituationToastState | null>(null);

  // Reset local state when the studentIds set changes (panel re-opened with
  // a different defaulter window). Use the joined id-set as the dependency.
  const idsKey = studentIds.join(',');
  useEffect(() => {
    setStatuses(new Map());
    setEdits(new Map());
  }, [idsKey]);

  // Drafts query — only enabled while the panel is open AND we have ids.
  // 5min stale time per task brief; React Query dedupes concurrent opens.
  const draftsQuery = useQuery<ReminderDraft[]>({
    queryKey: ['reminder-drafts', idsKey],
    queryFn: () => getReminderDrafts(studentIds),
    enabled: open && studentIds.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const drafts = draftsQuery.data ?? [];

  // Mutation for the approve call. We don't bind it to a single draft —
  // each Approve action passes its own payload. The success handler shows
  // a toast with the recall hint.
  const approveMutation = useMutation<
    ApprovalResult,
    Error,
    { drafts: ApprovedDraft[]; approvedIds: string[] }
  >({
    mutationFn: (vars) => approveReminderDrafts(vars.drafts),
    onSuccess: (result, vars) => {
      setStatuses((prev) => {
        const next = new Map(prev);
        for (const id of vars.approvedIds) next.set(id, 'approved');
        return next;
      });
      setToast({
        kind: 'success',
        message:
          `Approved ${result.approvedCount} reminder${result.approvedCount === 1 ? '' : 's'}.` +
          ' Recall window: 5 min — visit Reminders page to cancel.',
      });
    },
    onError: (err) => {
      setToast({
        kind: 'error',
        message: err.message || 'Failed to approve reminders.',
      });
    },
  });

  /**
   * Build an `ApprovedDraft` for a single studentId from the latest draft
   * + any local edit overlay. Returns `null` when the draft is missing
   * (shouldn't happen, but guards against race conditions).
   */
  const buildApprovedDraft = (studentId: string): ApprovedDraft | null => {
    const draft = drafts.find((d) => d.studentId === studentId);
    if (!draft) return null;
    const edit = edits.get(studentId);
    return {
      studentId,
      subject: edit?.subject ?? draft.subject,
      body: edit?.body ?? draft.body,
    };
  };

  /**
   * Currently pending (unactioned) drafts — those without an `approved` or
   * `skipped` status. Used to drive the bulk action counters and toggle
   * the bulk buttons disabled when the queue is empty.
   */
  const pendingDrafts = useMemo(
    () => drafts.filter((d) => (statuses.get(d.studentId) ?? 'pending') === 'pending'),
    [drafts, statuses],
  );
  const recommendedPending = useMemo(
    () => pendingDrafts.filter((d) => d.predictedReadRate >= 0.7),
    [pendingDrafts],
  );
  const approvedCount = useMemo(
    () =>
      Array.from(statuses.values()).filter((s) => s === 'approved').length,
    [statuses],
  );

  // Approve a single draft — POST one ApprovedDraft.
  const approveOne = (studentId: string) => {
    const payload = buildApprovedDraft(studentId);
    if (!payload) return;
    approveMutation.mutate({ drafts: [payload], approvedIds: [studentId] });
  };

  // Approve all pending drafts in one POST.
  const approveAll = () => {
    const payloads = pendingDrafts
      .map((d) => buildApprovedDraft(d.studentId))
      .filter((p): p is ApprovedDraft => p !== null);
    if (payloads.length === 0) return;
    approveMutation.mutate({
      drafts: payloads,
      approvedIds: payloads.map((p) => p.studentId),
    });
  };

  // Approve only "recommended" pending drafts (predictedReadRate >= 0.7).
  const approveRecommended = () => {
    const payloads = recommendedPending
      .map((d) => buildApprovedDraft(d.studentId))
      .filter((p): p is ApprovedDraft => p !== null);
    if (payloads.length === 0) return;
    approveMutation.mutate({
      drafts: payloads,
      approvedIds: payloads.map((p) => p.studentId),
    });
  };

  const skipOne = (studentId: string) => {
    setStatuses((prev) => {
      const next = new Map(prev);
      next.set(studentId, 'skipped');
      return next;
    });
  };

  const saveEdit = (studentId: string, subject: string, body: string) => {
    setEdits((prev) => {
      const next = new Map(prev);
      next.set(studentId, { subject, body });
      return next;
    });
  };

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${
          entered ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-drafts-title"
        className={`fixed top-0 right-0 bottom-0 z-[61] w-full lg:w-[640px] bg-white shadow-2xl flex flex-col transition-transform duration-200 ${
          entered ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <header className="flex items-start justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
              <Bell size={16} />
            </div>
            <div className="min-w-0">
              <h2
                id="reminder-drafts-title"
                className="text-base font-bold text-slate-800"
              >
                Draft reminders
              </h2>
              <div className="text-xs text-slate-500 mt-0.5">
                <Sparkles size={10} className="inline mr-1 -mt-0.5" />
                AI-personalized · review before sending
              </div>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="flex-shrink-0 h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </header>

        {/* Sticky top bar — bulk actions + counter */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={approveAll}
            disabled={
              draftsQuery.isLoading ||
              approveMutation.isPending ||
              pendingDrafts.length === 0
            }
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {approveMutation.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Check size={12} />
            )}
            Approve all ({pendingDrafts.length})
          </button>
          <button
            type="button"
            onClick={approveRecommended}
            disabled={
              draftsQuery.isLoading ||
              approveMutation.isPending ||
              recommendedPending.length === 0
            }
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            <Sparkles size={12} />
            Approve recommended ({recommendedPending.length})
          </button>
          <span className="ml-auto text-[11px] font-semibold text-slate-600">
            {approvedCount}/{drafts.length} approved
          </span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {draftsQuery.isLoading ? (
            <>
              <ReminderDraftSkeleton />
              <ReminderDraftSkeleton />
              <ReminderDraftSkeleton />
            </>
          ) : draftsQuery.isError ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="text-xs text-amber-800 flex items-center gap-1.5">
                <Sparkles size={12} aria-hidden />
                Reminder drafts unavailable.
              </div>
              <button
                type="button"
                onClick={() => draftsQuery.refetch()}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
              >
                Retry
              </button>
            </div>
          ) : drafts.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-500">
              No reminder drafts to review.
            </div>
          ) : (
            drafts.map((d) => (
              <ReminderDraftCard
                key={d.studentId}
                draft={d}
                defaulter={defaultersById.get(d.studentId)}
                status={statuses.get(d.studentId) ?? 'pending'}
                edited={edits.get(d.studentId)}
                onApprove={() => approveOne(d.studentId)}
                onSkip={() => skipOne(d.studentId)}
                onSaveEdit={(s, b) => saveEdit(d.studentId, s, b)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <footer className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500">
            After approval: 5-min recall window via the Reminders page.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
          >
            Close
          </button>
        </footer>
      </aside>

      <SituationToast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function FeeDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasAccess = useAuthStore((s) => s.hasPermission('finance', 'read'));

  // L7b — degraded mode for the LLM-spend gate. Flips to true when any
  // agent endpoint returns 429; stays true for the session (the budget
  // resets on a Monday, not on a refresh — this is intentional).
  const [budgetExceeded, setBudgetExceeded] = useState<boolean>(false);
  const [budgetWarning, setBudgetWarning] = useState<BudgetWarning | null>(null);

  const [monthAnchor, setMonthAnchor] = useState<Date>(new Date());
  const monthStart = useMemo(() => firstOfMonth(monthAnchor), [monthAnchor]);
  const monthEnd = useMemo(() => lastOfMonth(monthAnchor), [monthAnchor]);
  const fyStart = useMemo(() => fiscalYearStart(monthAnchor), [monthAnchor]);
  const isoMonthStart = toIsoDate(monthStart);
  const isoMonthEnd = toIsoDate(monthEnd);
  const isoFyStart = toIsoDate(fyStart);

  // MTD dashboard — the primary data source
  const mtdQuery = useQuery({
    queryKey: ['fee-dashboard-mtd', isoMonthStart, isoMonthEnd],
    queryFn: () => getDashboard({ from: isoMonthStart, to: isoMonthEnd }),
    staleTime: 2 * 60 * 1000,
    enabled: hasAccess,
  });

  // YTD — secondary query, cheaper to keep staler
  const ytdQuery = useQuery({
    queryKey: ['fee-dashboard-ytd', isoFyStart, isoMonthEnd],
    queryFn: () => getDashboard({ from: isoFyStart, to: isoMonthEnd }),
    staleTime: 5 * 60 * 1000,
    enabled: hasAccess,
  });

  const defaultersQuery = useQuery({
    queryKey: ['fee-defaulters', 'risk'],
    queryFn: () => getDefaulters({ limit: 20, sort: 'overdueAmount' }),
    staleTime: 2 * 60 * 1000,
    enabled: hasAccess,
  });

  const d = mtdQuery.data;
  const ytd = ytdQuery.data;
  const defaulters = defaultersQuery.data?.items ?? [];
  const overdueOver30d = defaulters.filter((x) => x.daysOverdue >= 30);
  const overdueOver30dTotal = overdueOver30d.reduce(
    (s, x) => s + x.overdueAmount,
    0,
  );

  // Batch-fetch deterministic risk scores for the visible defaulter list.
  // Backend caps at 100 ids; we render only the first 10 cards but score
  // the full visible window so the sort is consistent if the cap rises.
  const visibleStudentIds = useMemo(
    () => defaulters.map((x) => x.studentId),
    [defaulters],
  );
  const studentIdsKey = visibleStudentIds.join(',');
  const riskScoresQuery = useQuery<RiskScoresResponse>({
    queryKey: ['risk-scores', studentIdsKey],
    queryFn: () => getRiskScores(visibleStudentIds, false),
    enabled: hasAccess && visibleStudentIds.length > 0,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  // O(1) lookup map for per-card score injection.
  const riskScoresMap = useMemo(() => {
    const m = new Map<string, RiskScoreResult>();
    for (const r of riskScoresQuery.data?.scores ?? []) {
      m.set(r.studentId, r);
    }
    return m;
  }, [riskScoresQuery.data]);

  // O(1) lookup map for the reminder-drafts panel — maps studentId → the
  // visible defaulter row so per-card content can show the student name +
  // overdue context alongside the LLM's drafted message.
  const defaultersById = useMemo(() => {
    const m = new Map<string, DefaulterListItem>();
    for (const x of defaulters) m.set(x.studentId, x);
    return m;
  }, [defaulters]);

  // Reminder drafts panel state (A10). The panel is conditionally
  // rendered with a slide-in transform; closing leaves the previous
  // `draftStudentIds` in place so the slide-out animation has stable
  // content while it plays.
  const [draftPanelOpen, setDraftPanelOpen] = useState(false);
  const [draftStudentIds, setDraftStudentIds] = useState<string[]>([]);

  const openDraftPanel = (ids: string[]) => {
    setDraftStudentIds(ids);
    setDraftPanelOpen(true);
  };

  // Sort selector — default is "risk" (score desc; insufficient-data last).
  // While scores are still loading we visually fall back to amount sort
  // (the spec says: "Fall back to amount-sort visually until scores arrive").
  const [sortBy, setSortBy] = useState<'risk' | 'amount' | 'days'>('risk');
  const scoresReady = !riskScoresQuery.isLoading && !riskScoresQuery.isError;
  const effectiveSort: 'risk' | 'amount' | 'days' =
    sortBy === 'risk' && !scoresReady ? 'amount' : sortBy;

  const sortedDefaulters = useMemo(() => {
    const list = [...defaulters];
    if (effectiveSort === 'amount') {
      list.sort((a, b) => b.overdueAmount - a.overdueAmount);
    } else if (effectiveSort === 'days') {
      list.sort((a, b) => b.daysOverdue - a.daysOverdue);
    } else {
      // risk: score desc; null/insufficient-data items at the end.
      list.sort((a, b) => {
        const sa = riskScoresMap.get(a.studentId)?.score;
        const sb = riskScoresMap.get(b.studentId)?.score;
        const av = sa === null || sa === undefined ? -Infinity : sa;
        const bv = sb === null || sb === undefined ? -Infinity : sb;
        if (bv !== av) return bv - av;
        // Stable secondary sort by overdueAmount when scores tie (or
        // both lack scores) so the list doesn't reshuffle randomly.
        return b.overdueAmount - a.overdueAmount;
      });
    }
    return list;
  }, [defaulters, effectiveSort, riskScoresMap]);

  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  const refreshAll = () => {
    setIsRefreshingAll(true);

    // Non-AI queries: standard React Query invalidation.
    queryClient.invalidateQueries({ queryKey: ['fee-dashboard-mtd'] });
    queryClient.invalidateQueries({ queryKey: ['fee-dashboard-ytd'] });
    queryClient.invalidateQueries({ queryKey: ['fee-defaulters'] });

    // AI caches: force=true bypasses Redis and recomputes fresh.
    const aiRefreshes: Promise<unknown>[] = [
      getForecastNarrative(monthAnchor, true).then((result) => {
        queryClient.setQueryData<ForecastWithNarrative>(
          ['fee-forecast', monthAnchor.toISOString()],
          result,
        );
      }),
      getSituations(true).then((result) => {
        queryClient.setQueryData<SituationsResponse>(['situations'], result);
      }),
    ];

    if (visibleStudentIds.length > 0) {
      aiRefreshes.push(
        getRiskScores(visibleStudentIds, false, true).then((result) => {
          queryClient.setQueryData<RiskScoresResponse>(
            ['risk-scores', studentIdsKey],
            result,
          );
        }),
      );
    }

    Promise.allSettled(aiRefreshes).finally(() => setIsRefreshingAll(false));
  };

  const [isForceRefreshingRisk, setIsForceRefreshingRisk] = useState(false);
  const forceRefreshRiskScores = () => {
    if (visibleStudentIds.length === 0) return;
    setIsForceRefreshingRisk(true);
    getRiskScores(visibleStudentIds, false, true)
      .then((result) => {
        queryClient.setQueryData<RiskScoresResponse>(
          ['risk-scores', studentIdsKey],
          result,
        );
      })
      .catch(() => {
        queryClient.invalidateQueries({ queryKey: ['risk-scores'] });
      })
      .finally(() => setIsForceRefreshingRisk(false));
  };

  const scrollToRiskList = () => {
    document
      .getElementById('risk-list')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openStudent = (studentId: string) => {
    navigate(`/people/students/${studentId}`);
  };

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto mt-12 bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="text-sm font-semibold text-amber-900 mb-1">
          No access to finance analytics
        </div>
        <div className="text-xs text-amber-700">
          Your role does not have read permission on the finance module.
        </div>
        <Link
          to="/finance"
          className="inline-block mt-3 text-xs font-semibold text-blue-600 hover:underline"
        >
          Back to Finance hub
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-10">
      {/* L7b — Budget banner (warning at ≥ alert threshold, exceeded at 100%).
          Hydrated from the forecast query's `budgetWarning` payload via
          AIForecastBanner's onWarning callback. Renders nothing when no
          signal is present. */}
      <BudgetBanner warning={budgetWarning} exceeded={budgetExceeded} />

      {/* AI command bar */}
      <AICommandBar degraded={budgetExceeded} />

      {/* Page header */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Finance & Fees
          </div>
          <h1 className="text-xl md:text-2xl font-extrabold text-navy mt-0.5">
            {monthLabel(monthAnchor)} — Collection overview
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <MonthStepper anchor={monthAnchor} onChange={setMonthAnchor} />
          <button
            type="button"
            onClick={refreshAll}
            disabled={isRefreshingAll}
            className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-1.5 text-xs font-medium text-slate-600 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Refresh all data and AI caches"
            aria-label="Refresh all"
          >
            <RefreshCcw
              size={13}
              className={isRefreshingAll ? 'animate-spin' : ''}
            />
            {isRefreshingAll ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {mtdQuery.isError && (
        <div className="mb-4">
          <ErrorBanner onRetry={() => mtdQuery.refetch()} />
        </div>
      )}

      {/* AI forecast banner — self-fetches /forecast-narrative; renders its
          own loading / success / error states. Also acts as the v1 source
          of `budgetWarning` and the 429 detector for degraded mode. */}
      <AIForecastBanner
        monthAnchor={monthAnchor}
        highRiskCount={overdueOver30d.length}
        atRiskAmount={overdueOver30dTotal}
        onViewRisk={scrollToRiskList}
        degraded={budgetExceeded}
        onWarning={setBudgetWarning}
        on429={() => setBudgetExceeded(true)}
      />

      {/* Compact stats row */}
      <div className="flex gap-3 mb-4 flex-wrap md:flex-nowrap">
        <StatPill
          icon={<Wallet size={18} />}
          value={formatInrCompact(d?.collectedInRange)}
          label={`Collected (${monthAnchor.toLocaleDateString('en-IN', { month: 'short' })})`}
          tone="success"
        />
        <StatPill
          icon={<Clock size={18} />}
          value={formatInrCompact(d?.totalOutstanding)}
          label="Pending"
        />
        <StatPill
          icon={<TrendingUp size={18} />}
          value={formatInrCompact(ytd?.collectedInRange)}
          label="YTD total"
        />
        <StatPill
          icon={<AlertTriangle size={18} />}
          value={formatInrCompact(overdueOver30dTotal)}
          label="Overdue > 30d"
          tone="warn"
        />
      </div>

      {/* Agent findings — LLM-picked situation cards. Self-fetches via
          React Query (5-min stale time). `onDraftReminder` opens the
          A10 side panel filtered to this card's students. Suppressed in
          degraded mode (entire panel is LLM-derived). */}
      <SituationCards
        onDraftReminder={openDraftPanel}
        degraded={budgetExceeded}
      />

      {/* Risk list */}
      <div
        id="risk-list"
        className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      >
        <div className="flex items-start justify-between mb-3 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-bold text-slate-800">
                Students requiring action — AI risk-sorted
              </div>
              {riskScoresQuery.data?.cachedAt && (
                <span className="text-[10px] font-medium text-blue-600/60 bg-blue-50 px-2 py-0.5 rounded-full">
                  Cached · {formatCachedAt(riskScoresQuery.data.cachedAt)}
                </span>
              )}
              <button
                type="button"
                onClick={forceRefreshRiskScores}
                disabled={isForceRefreshingRisk || riskScoresQuery.isFetching}
                title="Refresh risk scores"
                aria-label="Refresh risk scores"
                className="h-6 w-6 rounded-md border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-400 disabled:opacity-50"
              >
                <RefreshCcw
                  size={11}
                  className={isForceRefreshingRisk ? 'animate-spin' : ''}
                />
              </button>
            </div>
            <div className="text-xs text-slate-500">
              Ranked by deterministic risk score (hover a badge for the AI breakdown)
            </div>
          </div>
          <div className="flex-shrink-0 flex gap-2">
            <Link
              to="/finance/holds"
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
            >
              Holds inbox
            </Link>
            <button
              type="button"
              onClick={() =>
                openDraftPanel(
                  // Take the top 10 currently visible (post-sort) defaulters
                  // — same window the cards are rendered from. Falls back to
                  // the unsorted list if scores haven't arrived yet.
                  sortedDefaulters.slice(0, 10).map((x) => x.studentId),
                )
              }
              disabled={defaulters.length === 0}
              className="text-xs font-semibold px-3 py-2 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              <Sparkles size={12} />
              Draft reminders
            </button>
          </div>
        </div>

        {/* Sort toggle + risk-loading pill. Hidden when there are no
            defaulters at all (empty state below covers that case). */}
        {defaulters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Sort by:
            </span>
            <button
              type="button"
              onClick={() => setSortBy('risk')}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                sortBy === 'risk'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Risk score
            </button>
            <button
              type="button"
              onClick={() => setSortBy('amount')}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                sortBy === 'amount'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Overdue amount
            </button>
            <button
              type="button"
              onClick={() => setSortBy('days')}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                sortBy === 'days'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Days overdue
            </button>
            {sortBy === 'risk' && riskScoresQuery.isLoading && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full">
                <Loader2 size={11} className="animate-spin" />
                Computing risk…
              </span>
            )}
          </div>
        )}

        {defaultersQuery.isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <LoadingBanner key={i} />
            ))}
          </div>
        ) : defaulters.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-500">
            No students currently need action. Collection is clean.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedDefaulters.slice(0, 10).map((item) => (
              <DefaulterCard
                key={item.studentId}
                item={item}
                riskScore={riskScoresMap.get(item.studentId)}
                onOpen={openStudent}
              />
            ))}
          </div>
        )}
      </div>

      {/* Two-col breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CollectionByProgrammeCard data={d?.dueByProgramme ?? []} />
        <PaymentModeCard
          data={
            d?.paymentModeBreakdown ?? {
              cash: 0,
              upi: 0,
              neft: 0,
              cheque: 0,
              online: 0,
              card: 0,
              other: 0,
            }
          }
        />
      </div>

      {/* Footnote on data lineage */}
      <div className="text-[11px] text-slate-400 mt-4">
        Data refreshes every 2 minutes. AI recommendations are currently rule-based
        placeholders — upgrade to the Finance AI agent when available.
      </div>

      {/* Reminder drafts side panel (A10) — overlay rendered at the page
          root so the backdrop covers the whole viewport regardless of any
          parent overflow constraints. */}
      <ReminderDraftsPanel
        open={draftPanelOpen}
        studentIds={draftStudentIds}
        defaultersById={defaultersById}
        onClose={() => setDraftPanelOpen(false)}
      />
    </div>
  );
}
