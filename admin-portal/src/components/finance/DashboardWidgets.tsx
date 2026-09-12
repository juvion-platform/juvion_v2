/** Non-AI presentational pieces of the fee dashboard. */
import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { DashboardV1, PaymentModeKey } from '../../services/fee-analytics';
import { formatInrCompact } from '../agent/format';

export function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
export function MonthStepper({
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
export function StatPill({
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
const CATEGORY_COLORS = [
  '#2B6CB0', // blue
  '#38B2AC', // teal
  '#6366F1', // indigo
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EC4899', // pink
  '#8B5CF6', // purple
];
export function CollectionByProgrammeCard({ data }: { data: DashboardV1['dueByProgramme'] }) {
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
export function PaymentModeCard({
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
