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
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
} from 'lucide-react';

import {
  getDashboard,
  getDefaulters,
  type DashboardV1,
  type DefaulterListItem,
  type PaymentModeKey,
} from '../../services/fee-analytics';
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

function severityStyles(item: DefaulterListItem): {
  wrap: string;
  amount: string;
  badge: { text: string; className: string };
} {
  if (item.daysOverdue >= 30) {
    return {
      wrap: 'bg-red-50 border-red-200',
      amount: 'text-red-700',
      badge: { text: 'Critical', className: 'bg-red-100 text-red-800' },
    };
  }
  if (item.daysOverdue >= 8) {
    return {
      wrap: 'bg-amber-50 border-amber-200',
      amount: 'text-amber-700',
      badge: { text: 'Overdue', className: 'bg-amber-100 text-amber-800' },
    };
  }
  return {
    wrap: 'bg-slate-50 border-slate-200',
    amount: 'text-slate-800',
    badge: { text: `${item.daysOverdue}d overdue`, className: 'bg-teal-100 text-teal-800' },
  };
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

function AIForecastBanner({
  projectedAmount,
  projectedPct,
  monthLabel,
  highRiskCount,
  atRiskAmount,
  onViewRisk,
}: {
  projectedAmount: number;
  projectedPct: number;
  monthLabel: string;
  highRiskCount: number;
  atRiskAmount: number;
  onViewRisk: () => void;
}) {
  return (
    <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-xl px-5 py-4 mb-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white">
          <Sparkles size={16} />
        </div>
        <div className="text-sm text-emerald-900 leading-snug min-w-0">
          <strong className="font-semibold">AI forecast:</strong>{' '}
          At current velocity, {monthLabel} collection will reach{' '}
          <strong className="font-semibold">{projectedPct.toFixed(0)}%</strong>{' '}
          by month-end (projected {formatInrCompact(projectedAmount)}).{' '}
          {highRiskCount > 0 ? (
            <>
              <strong className="font-semibold">{highRiskCount}</strong> students
              in high-default-risk zone — {formatInrCompact(atRiskAmount)} may need
              escalation.
            </>
          ) : (
            <>No students in the high-default-risk zone right now.</>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onViewRisk}
        className="flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-lg bg-gradient-to-br from-blue-600 to-teal-500 text-white hover:shadow-md transition-shadow flex items-center gap-1"
      >
        View risk list
        <ArrowRight size={13} />
      </button>
    </div>
  );
}

function DefaulterCard({
  item,
  onOpen,
}: {
  item: DefaulterListItem;
  onOpen: (studentId: string) => void;
}) {
  const s = severityStyles(item);
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
        <span
          className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.badge.className}`}
        >
          {s.badge.text}
        </span>
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
 * Message in the chat thread. `pending` is set while waiting for the
 * AI response; replaced with the final text when the reply arrives.
 */
interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  pending?: boolean;
}

const CHAT_SUGGESTIONS = [
  'Show fee defaulters this month',
  'Draft a fee reminder for overdue parents',
  "Who is at risk of default next week?",
  'Summarize March collection performance',
];

/**
 * AI command bar + inline chat thread. Send handler is currently stubbed
 * (echoes a placeholder response) — wire to a real AI endpoint later by
 * replacing `stubAiReply` with an axios call.
 *
 * UX:
 *   - Always-visible compact bar with ✦ icon + input + ⌘K hint + suggestion chips
 *   - Focus or submit opens an inline thread panel below the bar
 *   - ⌘K / Ctrl+K anywhere on the page focuses the input
 *   - Close button in the thread header collapses back to the bar
 */
function AICommandBar() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  // Cmd/Ctrl+K focuses the input from anywhere on the page.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  // Auto-scroll the thread to the newest message.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    const pendingMsg: ChatMessage = {
      id: `a-${Date.now() + 1}`,
      role: 'ai',
      text: '',
      pending: true,
    };
    setMessages((m) => [...m, userMsg, pendingMsg]);
    setInput('');
    setIsOpen(true);
    // TODO: replace with real AI call. Preserve the user prompt in the echo
    // so it's obvious the channel works end-to-end.
    stubAiReply(trimmed).then((reply) => {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === pendingMsg.id ? { ...msg, text: reply, pending: false } : msg,
        ),
      );
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const clear = () => {
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
            placeholder='Ask anything or give a command — "show fee defaulters", "draft reminder", "who is at risk"…'
            className="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400"
          />
          {input.trim() ? (
            <button
              type="submit"
              aria-label="Send"
              className="flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white flex items-center justify-center hover:shadow-md"
            >
              <Send size={14} />
            </button>
          ) : (
            <kbd className="flex-shrink-0 text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
              ⌘K
            </kbd>
          )}
        </form>
        {/* Suggestion chips */}
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
                <div key={m.id} className="flex justify-start gap-2">
                  <div className="flex-shrink-0 h-6 w-6 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white mt-0.5">
                    <Sparkles size={11} />
                  </div>
                  <div className="max-w-[80%] bg-slate-50 text-slate-800 text-sm rounded-2xl rounded-bl-sm px-3.5 py-2 border border-slate-100">
                    {m.pending ? (
                      <span className="inline-flex items-center gap-2 text-slate-500">
                        <Loader2 size={12} className="animate-spin" />
                        Thinking…
                      </span>
                    ) : (
                      m.text
                    )}
                  </div>
                </div>
              ),
            )}
            <div ref={threadEndRef} />
          </div>
          <div className="px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400">
            Responses are currently placeholders — a Finance AI agent will be wired
            up shortly.
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Stub — returns a placeholder reply after a short delay. Replace with a
 * real axios call (e.g., POST /juvi/finance-agent/query) when the agent ships.
 */
async function stubAiReply(prompt: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 500 + Math.random() * 400));
  return `AI agent not wired up yet — your prompt ("${prompt.slice(0, 80)}${
    prompt.length > 80 ? '…' : ''
  }") was received. Real responses will appear here once the Finance AI agent is live.`;
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

// ── Page ──────────────────────────────────────────────────────────────

export default function FeeDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasAccess = useAuthStore((s) => s.hasPermission('finance', 'read'));

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

  const forecast = useMemo(() => {
    if (!d) return null;
    const today = new Date();
    const isCurrentMonth =
      today.getFullYear() === monthAnchor.getFullYear() &&
      today.getMonth() === monthAnchor.getMonth();
    const daysElapsed = isCurrentMonth
      ? today.getDate()
      : monthEnd.getDate();
    const daysInMonth = monthEnd.getDate();
    const avgDaily = d.collectedInRange / Math.max(1, daysElapsed);
    const projectedAmount = isCurrentMonth ? avgDaily * daysInMonth : d.collectedInRange;
    // Crude target = collected + outstanding (what was billed for this window).
    const target = d.collectedInRange + d.totalOutstanding;
    const projectedPct = target > 0 ? Math.min(100, (projectedAmount / target) * 100) : 0;
    return { projectedAmount, projectedPct, target };
  }, [d, monthAnchor, monthEnd]);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['fee-dashboard-mtd'] });
    queryClient.invalidateQueries({ queryKey: ['fee-dashboard-ytd'] });
    queryClient.invalidateQueries({ queryKey: ['fee-defaulters'] });
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
      {/* AI command bar */}
      <AICommandBar />

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
            className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCcw size={14} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {mtdQuery.isError && (
        <div className="mb-4">
          <ErrorBanner onRetry={() => mtdQuery.refetch()} />
        </div>
      )}

      {/* AI forecast banner */}
      {mtdQuery.isLoading ? (
        <div className="mb-4">
          <LoadingBanner />
        </div>
      ) : forecast ? (
        <AIForecastBanner
          projectedAmount={forecast.projectedAmount}
          projectedPct={forecast.projectedPct}
          monthLabel={monthAnchor.toLocaleDateString('en-IN', { month: 'long' })}
          highRiskCount={overdueOver30d.length}
          atRiskAmount={overdueOver30dTotal}
          onViewRisk={scrollToRiskList}
        />
      ) : null}

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

      {/* Risk list */}
      <div
        id="risk-list"
        className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      >
        <div className="flex items-start justify-between mb-3 gap-3">
          <div>
            <div className="text-sm font-bold text-slate-800">
              Students requiring action — AI risk-sorted
            </div>
            <div className="text-xs text-slate-500">
              Ranked by overdue amount and days past due
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
              disabled
              title="Bulk reminders are sent automatically by the nightly cron."
              className="text-xs font-semibold px-3 py-2 rounded-lg bg-gradient-to-br from-blue-600 to-teal-500 text-white opacity-60 cursor-not-allowed"
            >
              Send bulk reminders
            </button>
          </div>
        </div>

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
            {defaulters.slice(0, 10).map((item) => (
              <DefaulterCard key={item.studentId} item={item} onOpen={openStudent} />
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
    </div>
  );
}
