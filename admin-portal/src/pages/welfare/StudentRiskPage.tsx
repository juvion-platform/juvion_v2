/**
 * Student Risk board (008 Phase 2).
 *
 * Surface for the CCD compound-risk engine. The engine has scored students
 * since Phase 1 and its output has only ever landed on the generic Crisis
 * Alerts page, which shows type/severity/status and none of the score,
 * priority, signals or breakdown — so a computed P1 appeared there as an
 * unexplained "critical" row.
 *
 * The load-bearing widget is the breakdown panel. Anyone can print a risk
 * score; the reason this one is trustworthy is that a mentor can see the
 * arithmetic behind it and repeat it to a parent. Every number on this page is
 * computed server-side by `computeRiskScore` — nothing is derived in the
 * browser, and no AI is involved at this stage.
 *
 * Render states: loading skeleton · populated · empty (delayed 500ms so a fast
 * load doesn't flash) · error with retry that does not block the rest of the
 * page.
 */
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert, RefreshCw, AlertCircle, ArrowRight, Activity,
  CheckCircle2, Search, HeartHandshake, XCircle, Users,
} from 'lucide-react';

import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  getRiskBoard, getSignalsBySource, getMentorWorkload, getOutreachEffectiveness,
  getStudentRiskProfile, acknowledgeCCDAlert, investigateCCDAlert,
  interveneCCDAlert, resolveCCDAlert, markCCDFalsePositive,
  type RiskBoardRow,
} from '../../services/welfare';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

/** Source module → the words a registrar actually uses. */
const SOURCE_LABEL: Record<string, string> = {
  M03: 'Academics',
  M04: 'Fees',
  M06: 'Welfare',
  M08: 'Campus',
  Juvi: 'Juvi',
};

const SIGNAL_LABEL: Record<string, string> = {
  attendance_drop: 'Attendance drop',
  failing_grades: 'Failing grades',
  backlog_accumulation: 'Backlog accumulation',
  fee_default: 'Fee default',
  scholarship_loss: 'Scholarship loss',
  warden_concern: 'Warden concern',
  mess_attendance_drop: 'Mess attendance drop',
  messaging_withdrawal: 'Withdrawn from messaging',
  sentiment_anomaly: 'Sentiment anomaly',
  isolation_indicators: 'Isolation indicators',
  grievance_filed: 'Grievance filed',
  counselling_active: 'Counselling active',
};

const PRIORITY_STYLE: Record<string, { ring: string; chip: string; label: string; hint: string }> = {
  P1: { ring: 'border-red-300', chip: 'danger', label: 'P1 — Act today', hint: 'Score 75 and above' },
  P2: { ring: 'border-amber-300', chip: 'warning', label: 'P2 — This week', hint: 'Score 50 to 74' },
  P3: { ring: 'border-blue-300', chip: 'info', label: 'P3 — Monitor', hint: 'Score 35 to 49' },
};

function scoreTone(score: number): string {
  if (score >= 75) return 'text-red-700';
  if (score >= 50) return 'text-amber-700';
  return 'text-blue-700';
}

// ─── Signals by source ─────────────────────────────────────────────────────

function SignalsBySource() {
  const q = useQuery({
    queryKey: ['ccd-signals-by-source'],
    queryFn: () => getSignalsBySource(7),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (q.isLoading) return <Skeleton className="h-20 w-full rounded-xl mb-6" />;
  // A failed strip must not take the board down with it.
  if (q.isError || !q.data) return null;

  const rows = q.data as Array<{ source: string; count: number; signalTypes: string[] }>;
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <section aria-labelledby="signals-heading" className="mb-6" data-testid="signals-by-source">
      <h3 id="signals-heading" className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Signals this week
      </h3>
      {total === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500">
          No signals received in the last 7 days.
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {rows.map(r => (
            <div key={r.source} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs font-medium text-gray-500 uppercase">
                {SOURCE_LABEL[r.source] ?? r.source}
              </div>
              <div className="text-2xl font-bold text-navy mt-1 tabular-nums">{r.count}</div>
              <div className="text-xs text-gray-400 mt-1 truncate" title={r.signalTypes.join(', ')}>
                {r.signalTypes.map(t => SIGNAL_LABEL[t] ?? t).join(', ')}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-2">
        A student flagged by three or more different modules scores 1.5&times; higher — that is what this row is showing.
      </p>
    </section>
  );
}

// ─── The breakdown — the reason this page exists ───────────────────────────

function BreakdownPanel({ row, onClose }: { row: RiskBoardRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<'acknowledge' | 'investigate' | 'intervene' | 'false-positive' | null>(null);
  const [text, setText] = useState('');
  const [interventionType, setInterventionType] = useState('mentor_outreach');

  const profile = useQuery({
    queryKey: ['ccd-risk-profile', row.studentId],
    queryFn: () => getStudentRiskProfile(row.studentId),
    retry: false,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['ccd-board'] });
    void queryClient.invalidateQueries({ queryKey: ['ccd-mentor-workload'] });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (action === 'acknowledge') return acknowledgeCCDAlert(row.alertId, text);
      if (action === 'investigate') return investigateCCDAlert(row.alertId, text);
      if (action === 'intervene') return interveneCCDAlert(row.alertId, { type: interventionType, description: text });
      if (action === 'false-positive') return markCCDFalsePositive(row.alertId, text);
      return resolveCCDAlert(row.alertId);
    },
    onSuccess: () => { setAction(null); setText(''); refresh(); onClose(); },
  });

  const resolveMutation = useMutation({
    mutationFn: () => resolveCCDAlert(row.alertId),
    onSuccess: () => { refresh(); onClose(); },
  });

  const signals = (profile.data?.activeSignals ?? []) as Array<{
    _id: string; source: string; signalType: string; computedWeight: number; receivedAt: string;
  }>;
  const breakdown = profile.data?.riskScore?.breakdown as
    | { baseTotal: number; crossModuleMultiplier: number; temporalMultiplier: number; finalScore: number }
    | undefined;

  return (
    <Modal
      open
      onClose={onClose}
      widthClass="max-w-2xl"
      title={`${row.studentName} · ${row.rollNumber}`}
      description="Why this student was flagged"
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Badge variant={PRIORITY_STYLE[row.priority ?? 'P3']?.chip ?? 'default'}>{row.priority ?? '—'}</Badge>
          <span className={`text-3xl font-bold tabular-nums ${scoreTone(row.score)}`}>{row.score}</span>
          <span className="text-sm text-gray-500">
            open {row.daysOpen} {row.daysOpen === 1 ? 'day' : 'days'}
            {row.mentorName ? ` · mentor ${row.mentorName}` : ' · no mentor assigned'}
          </span>
        </div>

        {profile.isLoading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : profile.isError ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-center justify-between">
            <span>Could not load the signal breakdown.</span>
            <button onClick={() => void profile.refetch()} className="underline font-medium">Retry</button>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <caption className="sr-only">Signals contributing to this student's risk score</caption>
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="text-left font-medium text-gray-500 px-4 py-2">Signal</th>
                  <th scope="col" className="text-left font-medium text-gray-500 px-4 py-2">Module</th>
                  <th scope="col" className="text-right font-medium text-gray-500 px-4 py-2">Weight</th>
                </tr>
              </thead>
              <tbody>
                {signals.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-3 text-gray-500">No active signals — the score has decayed.</td></tr>
                ) : signals.map(s => (
                  <tr key={s._id} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-navy-dark">{SIGNAL_LABEL[s.signalType] ?? s.signalType}</td>
                    <td className="px-4 py-2 text-gray-500">{SOURCE_LABEL[s.source] ?? s.source}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.computedWeight}</td>
                  </tr>
                ))}
                {breakdown && (
                  <>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td className="px-4 py-2 font-medium" colSpan={2}>Base total</td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">{breakdown.baseTotal}</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-4 py-2 text-gray-600" colSpan={2}>
                        Signals span {row.sources.length} module{row.sources.length === 1 ? '' : 's'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                        &times;{breakdown.crossModuleMultiplier}
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-4 py-2 text-gray-600" colSpan={2}>Recent signal clustering</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                        &times;{breakdown.temporalMultiplier}
                      </td>
                    </tr>
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td className="px-4 py-2 font-bold text-navy" colSpan={2}>Final score (capped at 100)</td>
                      <td className={`px-4 py-2 text-right font-bold tabular-nums ${scoreTone(breakdown.finalScore)}`}>
                        {breakdown.finalScore}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        {action ? (
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            {action === 'intervene' && (
              <div>
                <label className={lbl} htmlFor="intervention-type">Intervention</label>
                <select id="intervention-type" className={inp} value={interventionType}
                        onChange={e => setInterventionType(e.target.value)}>
                  <option value="mentor_outreach">Mentor outreach</option>
                  <option value="counselling_referral">Counselling referral</option>
                  <option value="parent_contact">Parent contact</option>
                  <option value="financial_aid">Financial aid</option>
                  <option value="academic_support">Academic support</option>
                  <option value="other">Other</option>
                </select>
              </div>
            )}
            <div>
              <label className={lbl} htmlFor="action-note">
                {action === 'acknowledge' ? 'Initial assessment'
                  : action === 'investigate' ? 'Findings'
                  : action === 'false-positive' ? 'Why is this not a real risk?'
                  : 'What was done'}
              </label>
              <textarea id="action-note" className={inp} rows={3} value={text}
                        onChange={e => setText(e.target.value)} />
            </div>
            {mutation.isError && (
              <p className="text-sm text-red-600">That did not save. Check the note and try again.</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || text.trim().length === 0}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {mutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setAction(null); setText(''); }}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setAction('acknowledge')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">
              <CheckCircle2 size={15} /> Acknowledge
            </button>
            <button onClick={() => setAction('investigate')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">
              <Search size={15} /> Investigate
            </button>
            <button onClick={() => setAction('intervene')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">
              <HeartHandshake size={15} /> Log outreach
            </button>
            <button onClick={() => resolveMutation.mutate()} disabled={resolveMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-green-300 text-green-700 text-sm hover:bg-green-50 disabled:opacity-50">
              <CheckCircle2 size={15} /> Resolve
            </button>
            <button onClick={() => setAction('false-positive')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50">
              <XCircle size={15} /> Not a real risk
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Board ─────────────────────────────────────────────────────────────────

function RiskCard({ row, onOpen }: { row: RiskBoardRow; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      data-testid="risk-card"
      className={`w-full text-left bg-white rounded-xl border-2 p-4 shadow-sm hover:shadow-md transition-all ${PRIORITY_STYLE[row.priority ?? 'P3']?.ring ?? 'border-gray-200'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-navy-dark text-sm truncate">{row.studentName}</div>
          <div className="text-xs text-gray-500">{row.rollNumber}</div>
        </div>
        <span className={`text-2xl font-bold tabular-nums ${scoreTone(row.score)}`}>{row.score}</span>
      </div>

      <div className="flex flex-wrap gap-1 mt-3">
        {row.sources.map(s => (
          <span key={s} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[11px]">
            {SOURCE_LABEL[s] ?? s}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
        <span>{row.mentorName ?? 'No mentor'}</span>
        <span className="inline-flex items-center gap-1">
          {row.daysOpen}d
          {!row.lastActionAt && row.daysOpen >= 14 && (
            <AlertCircle size={13} className="text-amber-500" aria-label="No action taken" />
          )}
          <ArrowRight size={13} />
        </span>
      </div>
    </button>
  );
}

function MentorWorkload() {
  const q = useQuery({
    queryKey: ['ccd-mentor-workload'],
    queryFn: getMentorWorkload,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (q.isLoading || q.isError || !q.data) return null;
  const rows = q.data as Array<{ mentorName: string; open: number; unactioned: number; p1: number }>;
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="workload-heading" className="mt-10">
      <h3 id="workload-heading" className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <Users size={15} /> Mentor workload
      </h3>
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="text-left font-medium text-gray-500 px-4 py-2">Mentor</th>
              <th scope="col" className="text-right font-medium text-gray-500 px-4 py-2">Open</th>
              <th scope="col" className="text-right font-medium text-gray-500 px-4 py-2">P1</th>
              <th scope="col" className="text-right font-medium text-gray-500 px-4 py-2">Untouched 14d+</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.mentorName} className="border-t border-gray-100">
                <td className="px-4 py-2 text-navy-dark">{r.mentorName}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.open}</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium text-red-700">{r.p1}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${r.unactioned > 0 ? 'text-amber-700 font-medium' : 'text-gray-400'}`}>
                  {r.unactioned}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OutreachEffectiveness() {
  const q = useQuery({
    queryKey: ['ccd-outreach-effectiveness'],
    queryFn: () => getOutreachEffectiveness(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (q.isLoading || q.isError || !q.data || q.data.raised === 0) return null;
  const d = q.data;
  const steps: Array<{ label: string; value: number; tone: string }> = [
    { label: 'Alerts raised', value: d.raised, tone: 'text-navy-dark' },
    { label: 'Contacted', value: d.contacted, tone: 'text-navy-dark' },
    { label: 'Resolved', value: d.resolved, tone: 'text-green-700' },
    { label: 'Recurred', value: d.recurred, tone: d.recurred > 0 ? 'text-red-700' : 'text-gray-400' },
  ];

  return (
    <section aria-labelledby="effectiveness-heading" className="mt-10">
      <h3 id="effectiveness-heading" className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <HeartHandshake size={15} /> Outreach effectiveness — last {d.windowDays} days
      </h3>
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 flex flex-wrap items-center gap-x-2 gap-y-4">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            {i > 0 && <ArrowRight size={16} className="text-gray-300" />}
            <div className="text-center px-3">
              <div className={`text-2xl font-bold tabular-nums ${s.tone}`}>{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
        <p className="text-xs text-gray-400 basis-full">
          Recurred counts resolved alerts whose student was flagged again afterwards — the number this
          board exists to drive down.
        </p>
      </div>
    </section>
  );
}

export default function StudentRiskPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<RiskBoardRow | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);

  const board = useQuery({
    queryKey: ['ccd-board'],
    queryFn: () => getRiskBoard(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Delay the empty message so a fast load doesn't flash it.
  useEffect(() => {
    if (board.isSuccess && (board.data?.length ?? 0) === 0) {
      const t = window.setTimeout(() => setShowEmpty(true), 500);
      return () => window.clearTimeout(t);
    }
    setShowEmpty(false);
    return undefined;
  }, [board.isSuccess, board.data]);

  const rows = board.data ?? [];
  const byPriority = (p: string) => rows.filter(r => r.priority === p);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold text-navy flex items-center gap-2">
          <ShieldAlert size={24} className="text-red-600" /> Student Risk
        </h2>
        <button
          onClick={() => void queryClient.invalidateQueries({ queryKey: ['ccd-board'] })}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
        >
          <RefreshCw size={15} className={board.isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Students flagged by combining attendance, fees, hostel and counselling signals. Every score is
        computed from recorded activity — open a student to see the arithmetic.
      </p>

      <SignalsBySource />

      {board.isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      ) : board.isError ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-amber-800">Could not load the risk board.</span>
          <button onClick={() => void board.refetch()} className="text-sm font-medium text-amber-900 underline">
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        showEmpty ? (
          <div className="bg-white border border-gray-200 rounded-xl px-6 py-10 text-center" data-testid="risk-board-empty">
            <Activity size={28} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">No students are currently flagged.</p>
            <p className="text-sm text-gray-400 mt-1">
              Alerts appear here when attendance, fees, hostel or counselling report a concern.
            </p>
          </div>
        ) : null
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" data-testid="risk-board">
          {(['P1', 'P2', 'P3'] as const).map(p => {
            const items = byPriority(p);
            const style = PRIORITY_STYLE[p]!;
            return (
              <section key={p} aria-labelledby={`col-${p}`}>
                <div className="flex items-baseline justify-between mb-3">
                  <h3 id={`col-${p}`} className="text-sm font-semibold text-navy-dark">{style.label}</h3>
                  <span className="text-xs text-gray-400 tabular-nums">{items.length}</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">{style.hint}</p>
                <div className="space-y-3">
                  {items.length === 0 ? (
                    <div className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl px-4 py-6 text-center">
                      None
                    </div>
                  ) : items.map(row => (
                    <RiskCard key={row.alertId} row={row} onOpen={() => setSelected(row)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <MentorWorkload />
      <OutreachEffectiveness />

      {selected && <BreakdownPanel row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
