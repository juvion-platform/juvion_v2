/**
 * PinCoveragePage — the worklist for students who hold no usable fee pin.
 *
 * Import pins what it can at upload time; this is where the remainder is
 * cleared. Grouped by fee axes rather than listed per student because that is
 * how the work divides: "BTECH / CSE / convener / Year 1 — 46 students, no
 * structure published" is one task for Finance, and the same 46 rows are noise.
 *
 * Mounted at /finance/fee-management/pin-coverage.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pin, AlertTriangle } from 'lucide-react';

import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import { useAuthStore } from '../../stores/authStore';
import { confirmAction } from '../../stores/confirmStore';
import { toast } from '../../stores/toastStore';
import {
  getPinCoverage,
  bulkPin,
  COVERAGE_REASON_LABEL,
  COVERAGE_REASON_HINT,
  type CoverageReason,
  type CoverageGroup,
  type CoverageStudent,
} from '../../services/pin-coverage';

const REASONS: CoverageReason[] = [
  'no-matching-structure',
  'never-pinned',
  'year-unresolvable',
  'no-fee-responsible-guardian',
];

/** Only these can be fixed by pinning; the other two need data fixed first. */
const PINNABLE_REASONS: CoverageReason[] = ['never-pinned', 'year-unresolvable'];

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function axisLabel(g: CoverageGroup | CoverageStudent): string {
  return [g.programmeCode ?? '—', g.branchCode ?? 'any branch', g.quota ?? 'any quota',
    g.category ?? 'any category'].join(' / ');
}

export default function PinCoveragePage() {
  const qc = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  // The route is gated on finance:approve. `update` is accepted here too so
  // the control stays usable for the fee-admin persona, matching FeePinsPanel.
  const canPin = hasPermission('finance', 'approve') || hasPermission('finance', 'update');

  const [reason, setReason] = useState<CoverageReason | ''>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const { data, isLoading } = useQuery({
    queryKey: ['pin-coverage', reason, page, limit],
    queryFn: () => getPinCoverage({ page, limit, ...(reason ? { reason } : {}) }),
  });

  const pinMut = useMutation({
    mutationFn: bulkPin,
    meta: { silent: true },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['pin-coverage'] });
      qc.invalidateQueries({ queryKey: ['student-pins'] });
      if (res.pinned > 0 && res.noMatch === 0 && res.errors === 0) {
        toast.success(`Pinned ${res.pinned} student${res.pinned === 1 ? '' : 's'}`);
        return;
      }
      toast.warning(
        `Pinned ${res.pinned} of ${res.considered}`,
        [
          res.alreadyPinned ? `${res.alreadyPinned} already pinned.` : '',
          res.noMatch ? `${res.noMatch} still have no matching structure.` : '',
          res.skipped ? `${res.skipped} skipped.` : '',
          res.errors ? `${res.errors} failed.` : '',
        ].filter(Boolean).join(' '),
      );
    },
  });

  /** Dry run first, then confirm against real numbers rather than a guess. */
  async function runPin(studentIds: string[], label: string) {
    const dry = await bulkPin({ studentIds, dryRun: true });
    const ok = await confirmAction({
      title: `Pin ${dry.pinned} student${dry.pinned === 1 ? '' : 's'}?`,
      message: [
        label,
        dry.pinned > 0
          ? `They will be bound to an estimated ${inr(dry.totalPinnedAmount)} in fees.` : '',
        dry.alreadyPinned ? `${dry.alreadyPinned} already pinned and will be left alone.` : '',
        dry.noMatch ? `${dry.noMatch} have no matching structure and cannot be pinned yet.` : '',
        dry.rows.some((r) => r.yearAssumed)
          ? 'Some have no batch, so their admission year is assumed.' : '',
      ].filter(Boolean).join(' '),
      confirmLabel: 'Pin',
    });
    if (ok.confirmed) pinMut.mutate({ studentIds });
  }

  const groupColumns = [
    { key: 'reason', label: 'Reason',
      render: (g: CoverageGroup) => (
        <Badge variant={g.reason === 'never-pinned' ? 'info' : 'warning'}>
          {COVERAGE_REASON_LABEL[g.reason]}
        </Badge>
      ) },
    { key: 'axes', label: 'Programme / Branch / Quota / Category',
      render: (g: CoverageGroup) => <span className="text-sm">{axisLabel(g)}</span> },
    { key: 'yearOfStudy', label: 'Year',
      render: (g: CoverageGroup) => (g.yearOfStudy || '—') },
    { key: 'count', label: 'Students',
      render: (g: CoverageGroup) => <span className="font-semibold">{g.count}</span> },
  ];

  const studentColumns = [
    { key: 'name', label: 'Student',
      render: (s: CoverageStudent) => (
        <div>
          <div className="font-medium">{s.name || '—'}</div>
          <div className="text-xs text-gray-500">{s.rollNumber ?? 'no roll number'}</div>
        </div>
      ) },
    { key: 'axes', label: 'Axes',
      render: (s: CoverageStudent) => <span className="text-xs">{axisLabel(s)}</span> },
    { key: 'yearOfStudy', label: 'Year',
      render: (s: CoverageStudent) => (s.yearOfStudy || '—') },
    { key: 'reason', label: 'Reason',
      render: (s: CoverageStudent) => (
        <Badge variant={s.reason === 'never-pinned' ? 'info' : 'warning'}>
          {COVERAGE_REASON_LABEL[s.reason]}
        </Badge>
      ) },
    { key: 'actions', label: '',
      render: (s: CoverageStudent) => (
        PINNABLE_REASONS.includes(s.reason) ? (
          <button
            type="button"
            disabled={!canPin || pinMut.isPending}
            onClick={() => void runPin([s.studentId], `${s.name} · ${axisLabel(s)}.`)}
            title={canPin ? 'Pin this student now' : 'Finance approval permission required'}
            className="inline-flex items-center gap-1 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <Pin className="h-3.5 w-3.5" /> Pin now
          </button>
        ) : null
      ) },
  ];

  const pinnableOnPage = (data?.students ?? []).filter((s) => PINNABLE_REASONS.includes(s.reason));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">Pin Coverage</h2>
          <p className="text-sm text-gray-500">
            Students with no usable fee structure, and what each one needs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={reason}
            onChange={(e) => { setReason(e.target.value as CoverageReason | ''); setPage(1); }}
            className="rounded-lg border px-3 py-2 text-sm"
            aria-label="Filter by reason"
          >
            <option value="">All reasons</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>{COVERAGE_REASON_LABEL[r]}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!canPin || pinnableOnPage.length === 0 || pinMut.isPending}
            onClick={() => void runPin(
              pinnableOnPage.map((s) => s.studentId),
              `${pinnableOnPage.length} student(s) on this page.`,
            )}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {pinMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Pin size={16} />}
            Pin all matching
          </button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="coverage-header">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Coverage
          </div>
          <div className="mt-1 text-2xl font-extrabold text-slate-800">
            {data ? `${data.coveragePercent}%` : '—'}
          </div>
          <div className="text-xs text-gray-500">
            {data
              ? `${data.studentsWithActivePinForCurrentYear} of ${data.totalActiveStudents} active students`
              : ''}
          </div>
        </div>
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => { setReason(r); setPage(1); }}
            className={`rounded-lg border p-4 text-left transition hover:bg-slate-50 ${
              reason === r ? 'border-primary-300 bg-primary-50/40' : 'bg-white'
            }`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {COVERAGE_REASON_LABEL[r]}
            </div>
            <div className="mt-1 text-2xl font-extrabold text-slate-800">
              {data?.counts?.[r] ?? 0}
            </div>
          </button>
        ))}
      </div>

      {reason && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
          {COVERAGE_REASON_HINT[reason]}
        </div>
      )}

      <h3 className="mb-2 text-sm font-semibold text-slate-700">By fee axes</h3>
      <div className="mb-6">
        <DataTable
          columns={groupColumns}
          data={data?.groups ?? []}
          loading={isLoading}
          rowKey={(g: CoverageGroup) => `${g.reason}|${axisLabel(g)}|${g.yearOfStudy}`}
          emptyMessage="Every active student holds a usable fee pin."
        />
      </div>

      <h3 className="mb-2 text-sm font-semibold text-slate-700">Students</h3>
      <DataTable
        columns={studentColumns}
        data={data?.students ?? []}
        loading={isLoading}
        rowKey={(s: CoverageStudent) => s.studentId}
        emptyMessage="Nothing to show for this filter."
      />
      <Pagination
        page={data?.page ?? 1}
        pages={data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
    </div>
  );
}
