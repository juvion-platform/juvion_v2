/**
 * The per-student risk view on the People student detail page: score,
 * priority, the one-sentence "why", the signals that fired and a 90-day
 * score history. Every number is computed by the welfare engine; the model
 * only phrases the sentence.
 *
 * Renders nothing when the caller has no welfare access (403) — a Registrar
 * with `people` but no `welfare` grant sees the profile unchanged.
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowRight, Sparkles } from 'lucide-react';

import Badge from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { getStudentRiskProfile, getStudentScoreHistory } from '../../services/welfare';
import { getAlertNarrations } from '../../services/people-agent';

const SIGNAL_LABEL: Record<string, string> = {
  attendance_drop: 'Attendance drop', failing_grades: 'Failing grades', backlog_accumulation: 'Backlog accumulation',
  fee_default: 'Fee default', scholarship_loss: 'Scholarship loss', warden_concern: 'Warden concern',
  mess_attendance_drop: 'Mess attendance drop', messaging_withdrawal: 'Withdrawn from messaging',
  sentiment_anomaly: 'Sentiment anomaly', isolation_indicators: 'Isolation indicators',
  grievance_filed: 'Grievance filed', counselling_active: 'Counselling active',
};

const PRIORITY_CHIP: Record<string, 'danger' | 'warning' | 'info'> = { P1: 'danger', P2: 'warning', P3: 'info' };

function scoreTone(score: number): string {
  if (score >= 75) return 'text-red-700';
  if (score >= 50) return 'text-amber-700';
  return 'text-blue-700';
}

function statusOf(err: unknown): number | undefined {
  return (err as { response?: { status?: number } } | undefined)?.response?.status;
}

/** Tiny bar sparkline — one bar per snapshot, no chart library. */
function ScoreHistory({ points }: { points: Array<{ at: string; score: number }> }) {
  if (points.length < 2) return null;
  const max = Math.max(100, ...points.map((p) => p.score));
  return (
    <div className="mt-3">
      <div className="text-[11px] font-medium text-gray-500 mb-1">Score over the last 90 days</div>
      <div className="flex items-end gap-0.5 h-12" role="img" aria-label={`${points.length} score snapshots, latest ${points[points.length - 1]!.score}`}>
        {points.map((p) => (
          <div
            key={p.at}
            title={`${new Date(p.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}: ${p.score}`}
            className={`flex-1 rounded-t ${p.score >= 75 ? 'bg-red-400' : p.score >= 50 ? 'bg-amber-400' : 'bg-blue-300'}`}
            style={{ height: `${Math.max(4, (p.score / max) * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function StudentRiskBlock({ studentId }: { studentId: string }) {
  const profile = useQuery({
    queryKey: ['ccd-risk-profile', studentId],
    queryFn: () => getStudentRiskProfile(studentId),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const history = useQuery({
    queryKey: ['ccd-score-history', studentId],
    queryFn: () => getStudentScoreHistory(studentId, 90),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: profile.isSuccess,
  });
  const alertId = (profile.data?.activeAlerts?.[0] as { _id?: string } | undefined)?._id;
  const narration = useQuery({
    queryKey: ['ccd-narration', alertId],
    queryFn: () => getAlertNarrations([alertId!]).then((n) => n[0]?.narrative ?? null),
    enabled: Boolean(alertId),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  if (profile.isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  // No welfare grant (403), unknown to the engine (404) or any other failure:
  // stay silent — a risk widget must never break a student's profile page.
  if (profile.isError || !profile.data) {
    if (import.meta.env.DEV && ![403, 404].includes(statusOf(profile.error) ?? 0)) console.warn('[student-risk] profile failed', profile.error);
    return null;
  }

  const risk = profile.data.riskScore as { score: number; priority: string | null } | undefined;
  const signals = (profile.data.activeSignals ?? []) as Array<{ _id: string; signalType: string; source: string }>;
  const score = risk?.score ?? 0;
  const priority = risk?.priority ?? null;

  return (
    <section
      aria-labelledby="student-risk-heading"
      data-testid="student-risk-block"
      className={`bg-white rounded-xl border-2 p-5 ${priority === 'P1' ? 'border-red-200' : priority === 'P2' ? 'border-amber-200' : 'border-gray-200'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="student-risk-heading" className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <Activity size={15} /> Risk
          </h3>
          <div className="flex items-center gap-3 mt-2">
            <span className={`text-3xl font-bold tabular-nums ${scoreTone(score)}`}>{score}</span>
            {priority ? (
              <Badge variant={PRIORITY_CHIP[priority] ?? 'default'}>{priority}</Badge>
            ) : (
              <span className="text-sm text-gray-500">Not flagged</span>
            )}
          </div>
        </div>
        {priority && (
          <Link to="/welfare/student-risk" className="text-xs font-medium text-primary-700 hover:underline inline-flex items-center gap-1 flex-shrink-0">
            Open on risk board <ArrowRight size={12} />
          </Link>
        )}
      </div>

      {alertId && (
        <p className="mt-3 text-sm text-gray-700 flex items-start gap-1.5" data-testid="student-risk-narration">
          <Sparkles size={13} className="text-violet-500 mt-0.5 flex-shrink-0" aria-hidden />
          {narration.isLoading ? (
            <span className="text-gray-400">Explaining…</span>
          ) : narration.data ? (
            <span>{narration.data}</span>
          ) : (
            <span className="text-gray-400">Explanation unavailable — the signals below stand on their own.</span>
          )}
        </p>
      )}

      {signals.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {signals.map((s) => (
            <span key={s._id} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">
              {SIGNAL_LABEL[s.signalType] ?? s.signalType}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-500">No active risk signals.</p>
      )}

      {history.data && <ScoreHistory points={history.data} />}
    </section>
  );
}
