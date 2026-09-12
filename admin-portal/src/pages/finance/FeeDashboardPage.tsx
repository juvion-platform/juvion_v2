/**
 * FeeDashboardPage (T9 — Fee Collection Analytics & Alerts)
 *
 * Composition only. The agent widgets (forecast banner, command bar,
 * situation cards, risk-scored cards, render states) live in
 * `components/agent/` and are shared with the People risk board; the
 * finance-only pieces (stat pills, breakdown cards, reminder drafts panel)
 * live in `components/finance/`.
 *
 * Layout:
 *   Budget banner · AI command bar · header (month picker + refresh)
 *   AI forecast banner · 4 stat pills · agent findings
 *   Students requiring action (risk-sorted) · programme + payment-mode split
 *
 * Data source: `GET /finance/analytics/dashboard` + `/defaulters`.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, Loader2, RefreshCcw, Sparkles, TrendingUp, Wallet } from 'lucide-react';

import { getDashboard, getDefaulters, type DefaulterListItem } from '../../services/fee-analytics';
import {
  getForecastNarrative,
  getRiskScores,
  getSituations,
  type BudgetWarning,
  type RiskScoreResult,
} from '../../services/finance-agent';
import BudgetBanner from '../../components/finance/BudgetBanner';
import { ReminderDraftsPanel } from '../../components/finance/ReminderDraftsPanel';
import {
  CollectionByProgrammeCard,
  MonthStepper,
  PaymentModeCard,
  StatPill,
  monthLabel,
} from '../../components/finance/DashboardWidgets';
import CommandBar from '../../components/agent/CommandBar';
import { AIForecastBanner } from '../../components/agent/ForecastBanner';
import { DefaulterCard } from '../../components/agent/ScoreCard';
import { SituationCards } from '../../components/agent/SituationCards';
import { ErrorBanner, LoadingBanner } from '../../components/agent/states';
import { agentKeys, forceInto, useRiskScores } from '../../components/agent/useAgent';
import { formatCachedAt, formatInrCompact } from '../../components/agent/format';
import { useAuthStore } from '../../stores/authStore';

const CHAT_SUGGESTIONS = [
  'Show fee defaulters this month',
  'Draft a fee reminder for overdue parents',
  "Who is at risk of default next week?",
  'Summarize March collection performance',
];

// ── Date helpers ─────────────────────────────────────────────────────

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  // Deduped: a student with two active defaulter records must not be sent
  // twice — the backend's cross-college check counts ids and returns 403.
  const visibleStudentIds = useMemo(
    () => [...new Set(defaulters.map((x) => x.studentId))],
    [defaulters],
  );
  const studentIdsKey = visibleStudentIds.join(',');
  const riskScoresQuery = useRiskScores(visibleStudentIds, hasAccess);

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
      forceInto(queryClient, agentKeys.forecast(monthAnchor.toISOString()), () => getForecastNarrative(monthAnchor, true)),
      forceInto(queryClient, agentKeys.situations, () => getSituations(true)),
    ];
    if (visibleStudentIds.length > 0) {
      aiRefreshes.push(
        forceInto(queryClient, agentKeys.riskScores(studentIdsKey), () => getRiskScores(visibleStudentIds, false, true)),
      );
    }
    Promise.allSettled(aiRefreshes).finally(() => setIsRefreshingAll(false));
  };

  const [isForceRefreshingRisk, setIsForceRefreshingRisk] = useState(false);
  const forceRefreshRiskScores = () => {
    if (visibleStudentIds.length === 0) return;
    setIsForceRefreshingRisk(true);
    void forceInto(queryClient, agentKeys.riskScores(studentIdsKey), () => getRiskScores(visibleStudentIds, false, true))
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
      <CommandBar
        endpoint="/juvi/finance-agent/query"
        title="Finance AI assistant"
        storageKey="finance-agent-convo"
        placeholder='Ask anything or give a command — "show fee defaulters", "draft reminder", "who is at risk"…'
        suggestions={CHAT_SUGGESTIONS}
        footer="Powered by the Juvion Finance AI agent. Conversation context is kept on this device per college; press Esc to cancel a streaming reply."
        degraded={budgetExceeded}
      />

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
