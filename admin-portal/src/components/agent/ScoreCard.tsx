/** One risk-scored student row — the finance "students requiring action" card. */
import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';

import type { DefaulterListItem } from '../../services/fee-analytics';
import type { RiskScoreResult } from '../../services/finance-agent';
import { formatInrCompact, formatInrFull, initials } from './format';
import { RiskHoverPopover } from './ScorePopover';

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
export function DefaulterCard({
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
