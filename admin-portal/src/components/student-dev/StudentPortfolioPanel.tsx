import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, RefreshCw, Send, Undo2, Archive, Lightbulb, FolderOpen,
} from 'lucide-react';
import Badge from '../ui/Badge';
import { confirmAction } from '../../stores/confirmStore';
import {
  getStudentPortfolio,
  getPortfolioCompleteness,
  listPortfolioEntries,
  assemblePortfolio,
  publishPortfolio,
  unpublishPortfolio,
  finalisePortfolio,
} from '../../services/student-dev';

const STATUS_VARIANT: Record<string, string> = {
  draft: 'default', published: 'success', archived: 'info',
};

const SECTION_LABELS: Record<string, string> = {
  leadership: 'Leadership',
  achievements: 'Achievements',
  certifications: 'Certifications',
  community: 'Community',
  events: 'Events',
  clubs: 'Clubs',
  projects: 'Projects',
};

/**
 * Student Development portfolio for one student.
 *
 * Lives here rather than on an admin list page because the API is
 * student-scoped — GET /student-dev/portfolios/:studentId, and
 * assemble/publish/finalise all key off a studentId. There is no
 * college-wide portfolio list endpoint to build a table from.
 */
export default function StudentPortfolioPanel({ studentId }: { studentId: string }) {
  const qc = useQueryClient();

  const portfolioQuery = useQuery({
    queryKey: ['student-portfolio', studentId],
    queryFn: () => getStudentPortfolio(studentId),
    enabled: Boolean(studentId),
    // A student with no portfolio yet 404s; that is a normal state here, not
    // an error worth retrying or toasting.
    retry: false,
    meta: { silentError: true },
  });

  const portfolio = portfolioQuery.data;
  const portfolioId = portfolio?._id;

  const completenessQuery = useQuery({
    queryKey: ['student-portfolio-completeness', studentId],
    queryFn: () => getPortfolioCompleteness(studentId),
    enabled: Boolean(portfolioId),
    retry: false,
    meta: { silentError: true },
  });

  const entriesQuery = useQuery({
    queryKey: ['portfolio-entries', portfolioId],
    queryFn: () => listPortfolioEntries(portfolioId),
    enabled: Boolean(portfolioId),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['student-portfolio', studentId] });
    qc.invalidateQueries({ queryKey: ['student-portfolio-completeness', studentId] });
    qc.invalidateQueries({ queryKey: ['portfolio-entries'] });
  }

  const assembleMut = useMutation({
    mutationFn: () => assemblePortfolio(studentId),
    meta: { successMessage: 'Portfolio assembled from the student’s records' },
    onSuccess: invalidate,
  });
  const publishMut = useMutation({
    mutationFn: () => publishPortfolio(studentId),
    meta: { successMessage: 'Portfolio published' },
    onSuccess: invalidate,
  });
  const unpublishMut = useMutation({
    mutationFn: () => unpublishPortfolio(studentId),
    meta: { successMessage: 'Portfolio unpublished' },
    onSuccess: invalidate,
  });
  const finaliseMut = useMutation({
    mutationFn: () => finalisePortfolio(studentId),
    meta: { successMessage: 'Portfolio finalised and snapshotted' },
    onSuccess: invalidate,
  });

  const busy = assembleMut.isPending || publishMut.isPending
    || unpublishMut.isPending || finaliseMut.isPending;

  async function handleFinalise() {
    const ok = await confirmAction({
      title: 'Finalise this portfolio?',
      message: 'Takes an immutable snapshot of every entry and archives the portfolio. Further changes will not be reflected.',
      confirmLabel: 'Finalise',
    });
    if (ok.confirmed) finaliseMut.mutate();
  }

  if (portfolioQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        <Loader2 size={15} className="animate-spin" /> Loading portfolio…
      </div>
    );
  }

  // No portfolio yet — offer to build one rather than showing an error.
  if (!portfolio) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400">
          <FolderOpen size={18} />
        </span>
        <p className="mt-3 text-sm text-slate-600">
          This student has no portfolio yet.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Assembling pulls their clubs, events, achievements, certifications and projects into one profile.
        </p>
        <button
          type="button"
          disabled={assembleMut.isPending}
          onClick={() => assembleMut.mutate()}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
        >
          <RefreshCw size={14} className={assembleMut.isPending ? 'animate-spin' : ''} />
          {assembleMut.isPending ? 'Assembling…' : 'Assemble portfolio'}
        </button>
      </div>
    );
  }

  const score = completenessQuery.data?.score ?? portfolio.completenessScore ?? 0;
  const missing = completenessQuery.data?.gapAnalysis?.missingAreas ?? [];
  const recommendations = completenessQuery.data?.gapAnalysis?.recommendations ?? [];
  const entries: any[] = entriesQuery.data?.items ?? [];
  const archived = portfolio.status === 'archived';

  const bySection = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.section] = (acc[e.section] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge variant={(STATUS_VARIANT[portfolio.status] ?? 'default') as any}>{portfolio.status}</Badge>
          <span className="text-sm text-slate-600">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</span>
          {portfolio.publishedDate && (
            <span className="text-xs text-slate-400">
              Published {new Date(portfolio.publishedDate).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || archived}
            onClick={() => assembleMut.mutate()}
            title="Re-pull entries from the student's records"
            className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={13} className={assembleMut.isPending ? 'animate-spin' : ''} /> Re-assemble
          </button>
          {portfolio.status !== 'published' ? (
            <button
              type="button"
              disabled={busy || archived}
              onClick={() => publishMut.mutate()}
              className="inline-flex items-center gap-1.5 rounded bg-teal-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
            >
              <Send size={13} /> Publish
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => unpublishMut.mutate()}
              className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Undo2 size={13} /> Unpublish
            </button>
          )}
          <button
            type="button"
            disabled={busy || archived}
            onClick={() => void handleFinalise()}
            className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Archive size={13} /> Finalise
          </button>
        </div>
      </div>

      {archived && (
        <p className="rounded bg-slate-50 px-3 py-2 text-xs text-slate-500">
          This portfolio is finalised. The snapshot taken on{' '}
          {portfolio.snapshotDate ? new Date(portfolio.snapshotDate).toLocaleDateString() : 'finalisation'} is immutable.
        </p>
      )}

      {/* Completeness */}
      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">Completeness</span>
          <span className="text-slate-600">{score}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={`h-full rounded-full transition-all ${score >= 70 ? 'bg-teal-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
          />
        </div>
      </div>

      {/* Section breakdown */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.keys(SECTION_LABELS).map((key) => {
          const count = bySection[key] ?? 0;
          return (
            <div key={key} className={`rounded-lg border px-3 py-2 ${count === 0 ? 'border-dashed border-slate-200 bg-slate-50' : 'border-slate-200'}`}>
              <p className="text-xs text-slate-500">{SECTION_LABELS[key]}</p>
              <p className={`text-lg font-semibold ${count === 0 ? 'text-slate-300' : 'text-slate-800'}`}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Gaps */}
      {missing.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
            <Lightbulb size={14} /> {missing.length} area{missing.length === 1 ? '' : 's'} with no entries
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-amber-800">
            {recommendations.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
