/**
 * GenerateBillsPage — turn pinned students into semester-installment invoices (007).
 *
 * The billing console. Set the filters, press Preview, and every student the run
 * would touch appears as a row — name, roll, axes, ₹, and what will happen to
 * them. Untick anyone you want held back, then bill only the ticked.
 *
 * It used to report counts and nothing else: you approved the integer 12 without
 * ever learning which twelve, could not exclude one student, and were never told
 * the amount. The table exists so the screen names its subjects, not just its
 * outcomes. See ../../../.sdd/specs/007-fee-billing-payment-ar/
 * plan-generate-bills-console.md for the problem list this closes.
 *
 * Two invariants worth keeping:
 *  - Generate posts `studentIds` and NOTHING else. The backend still applies its
 *    yearOfStudy filter on top of an explicit id list, so sending the filters too
 *    would silently drop ticked students.
 *  - The table never outlives the filters that produced it — changing any filter
 *    clears it, or you would bill a cohort you are no longer looking at.
 *
 * finance:create gated (admin / ST-ACC — NOT principal, which holds only approve+read).
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Receipt, Loader2, Search } from 'lucide-react';

import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import { listSemesters, listProgrammes, listBranches } from '../../services/academics';
import {
  generateFeeBills,
  getBillingHistory,
  type GenerateFeeBillsResult,
  type BillRow,
  type BillRowOutcome,
  type BillingHistoryRow,
} from '../../services/finance';
import { useAuthStore } from '../../stores/authStore';
import { confirmAction } from '../../stores/confirmStore';
import { toast } from '../../stores/toastStore';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** `generated` means "will be billed" on a preview and "was billed" after a run. */
function outcomeBadge(o: BillRowOutcome, dryRun: boolean): { label: string; variant: string } {
  switch (o) {
    case 'generated': return { label: dryRun ? 'Billable' : 'Generated', variant: 'success' };
    case 'already-billed': return { label: 'Already billed', variant: 'default' };
    case 'no-active-pin': return { label: 'No pin', variant: 'warning' };
    case 'pinned-to-different-ay': return { label: 'Different year', variant: 'warning' };
    case 'no-amount': return { label: 'No amount', variant: 'warning' };
    case 'unsupported-semester-number': return { label: 'Bad semester', variant: 'warning' };
    case 'error': return { label: 'Error', variant: 'danger' };
  }
}

interface Filters {
  semesterId: string;
  programmeId: string;
  branchId: string;
  yearOfStudy: string;
  dueDate: string;
}

const EMPTY_FILTERS: Filters = {
  semesterId: '', programmeId: '', branchId: '', yearOfStudy: '', dueDate: '',
};

/**
 * What has been billed already, per semester. Reads invoices that exist rather
 * than a run log, so it covers every bill ever generated — including those
 * raised before this screen did.
 *
 * Reports only what was BILLED. Collections and outstanding live on the finance
 * dashboard, off StudentFeeAccount; repeating them here is how two screens start
 * disagreeing about money.
 */
function BillingHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ['billing-history'],
    queryFn: getBillingHistory,
    staleTime: 60_000,
  });

  const columns = [
    { key: 'semesterLabel', label: 'Semester' },
    {
      key: 'invoiceCount',
      label: 'Billed',
      sortValue: (r: BillingHistoryRow) => r.invoiceCount,
      // "12" alone cannot say whether a semester is finished. Against the
      // billable population it can.
      render: (r: BillingHistoryRow) => {
        if (r.pinnedStudents === 0) return <span className="font-mono">{r.invoiceCount}</span>;
        const done = r.invoiceCount >= r.pinnedStudents;
        return (
          <span className="inline-flex items-center gap-2">
            <span className="font-mono">{r.invoiceCount} of {r.pinnedStudents}</span>
            <Badge variant={done ? 'success' : 'warning'}>
              {done ? 'Complete' : `${r.pinnedStudents - r.invoiceCount} left`}
            </Badge>
          </span>
        );
      },
    },
    {
      key: 'totalBilled',
      label: 'Total billed',
      sortValue: (r: BillingHistoryRow) => r.totalBilled,
      render: (r: BillingHistoryRow) => <span className="font-mono">{inr(r.totalBilled)}</span>,
    },
    {
      key: 'lastGeneratedAt',
      label: 'Generated',
      render: (r: BillingHistoryRow) => {
        const first = new Date(r.firstGeneratedAt).toLocaleDateString('en-IN');
        const last = new Date(r.lastGeneratedAt).toLocaleDateString('en-IN');
        // A spread means bills were topped up after the original run.
        return first === last ? first : `${first} – ${last}`;
      },
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (r: BillingHistoryRow) => (
        // Links into the Invoices page rather than rebuilding a list inside this
        // table — that page already exists and already does this well.
        <Link
          to={`/finance/fee-management/invoices?semesterId=${r.semesterId}`}
          className="text-xs text-primary-600 hover:underline"
        >
          View invoices →
        </Link>
      ),
    },
  ];

  return (
    <div className="mt-10" data-testid="billing-history">
      <h3 className="mb-2 text-sm font-semibold text-navy">Previously generated</h3>
      <DataTable
        columns={columns as never}
        data={data ?? []}
        loading={isLoading}
        rowKey={(r: BillingHistoryRow) => r.semesterId}
        emptyMessage="No bills have been generated yet."
      />
    </div>
  );
}

export default function GenerateBillsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canGenerate = hasPermission('finance', 'create');
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [preview, setPreview] = useState<GenerateFeeBillsResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const { data: semData } = useQuery({ queryKey: ['semesters-billing'], queryFn: () => listSemesters(1, 200) });
  const { data: progData } = useQuery({ queryKey: ['programmes-billing'], queryFn: () => listProgrammes(1, 200) });
  const { data: branchData } = useQuery({ queryKey: ['branches-billing'], queryFn: () => listBranches(1, 200) });
  const semesters: any[] = semData?.items || [];
  const programmes: any[] = progData?.items || [];
  const branches: any[] = branchData?.items || [];

  /**
   * Any filter change invalidates the table. Without this you could narrow to
   * MTECH, still be looking at the BTECH rows, and bill the wrong cohort.
   */
  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPreview(null);
    setSelected(new Set());
  }

  function requestBody(dryRun: boolean) {
    return {
      semesterId: filters.semesterId,
      ...(filters.programmeId ? { programmeId: filters.programmeId } : {}),
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.yearOfStudy ? { yearOfStudy: Number(filters.yearOfStudy) } : {}),
      ...(filters.dueDate ? { dueDate: filters.dueDate } : {}),
      ...(dryRun ? { dryRun: true } : {}),
    };
  }

  const previewMut = useMutation({
    mutationFn: () => generateFeeBills(requestBody(true)),
    meta: { silent: true },
    onSuccess: (res) => {
      setPreview(res);
      setSelected(new Set(res.rows.filter((r) => r.outcome === 'generated').map((r) => r.studentId)));
    },
    onError: () => toast.error('Could not load the preview'),
  });

  const genMut = useMutation({
    mutationFn: (studentIds: string[]) =>
      // studentIds ONLY — the filters are already baked into the selection, and
      // the backend would re-apply yearOfStudy on top and drop ticked rows.
      generateFeeBills({
        semesterId: filters.semesterId,
        studentIds,
        ...(filters.dueDate ? { dueDate: filters.dueDate } : {}),
      }),
    meta: { silent: true },
    onSuccess: (res) => {
      setPreview(res);
      setSelected(new Set());
      // The run just changed what history reports.
      queryClient.invalidateQueries({ queryKey: ['billing-history'] });
      if (res.generated > 0 && res.errors.length === 0) {
        toast.success(`Generated ${res.generated} bill${res.generated === 1 ? '' : 's'} · ${inr(res.totalAmount)}`);
      } else {
        toast.warning(
          `Generated ${res.generated}`,
          [
            res.alreadyBilled ? `${res.alreadyBilled} already billed.` : '',
            res.errors.length ? `${res.errors.length} failed.` : '',
          ].filter(Boolean).join(' '),
        );
      }
    },
  });

  const rows = preview?.rows ?? [];
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.name.toLowerCase().includes(q) || (r.rollNumber ?? '').toLowerCase().includes(q));
  }, [rows, search]);

  const billable = rows.filter((r) => r.outcome === 'generated');
  // Summed over the SELECTED rows, never from the response's totalAmount, which
  // is only right while everything is still ticked.
  const selectedTotal = rows.reduce((s, r) => (selected.has(r.studentId) ? s + r.amount : s), 0);

  function toggle(studentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  }

  const allBillableSelected = billable.length > 0 && billable.every((r) => selected.has(r.studentId));

  async function generate() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = await confirmAction({
      title: `Generate ${ids.length} bill${ids.length === 1 ? '' : 's'}?`,
      message: `${inr(selectedTotal)} will be raised against ${ids.length} student${ids.length === 1 ? '' : 's'}.`
        + (filters.dueDate ? ` Due ${new Date(filters.dueDate).toLocaleDateString('en-IN')}.` : ' Due in 30 days.'),
      confirmLabel: 'Generate',
    });
    if (ok.confirmed) genMut.mutate(ids);
  }

  const columns = [
    {
      key: 'select',
      label: '',
      sortable: false,
      render: (r: BillRow) => (
        <input
          type="checkbox"
          checked={selected.has(r.studentId)}
          disabled={r.outcome !== 'generated'}
          onChange={() => toggle(r.studentId)}
          aria-label={`Select ${r.name || r.rollNumber || r.studentId}`}
          className="h-4 w-4 rounded border-gray-300 disabled:opacity-40"
        />
      ),
    },
    { key: 'name', label: 'Student', render: (r: BillRow) => r.name || <span className="text-gray-400">—</span> },
    { key: 'rollNumber', label: 'Roll', render: (r: BillRow) => r.rollNumber || '—' },
    {
      key: 'programmeCode',
      label: 'Programme',
      render: (r: BillRow) => [r.programmeCode, r.branchCode].filter(Boolean).join(' / ') || '—',
    },
    {
      key: 'yearOfStudy',
      label: 'Yr',
      render: (r: BillRow) => (r.yearOfStudy > 0 ? r.yearOfStudy : '—'),
    },
    {
      key: 'amount',
      label: 'Amount',
      sortValue: (r: BillRow) => r.amount,
      render: (r: BillRow) => (r.amount > 0 ? <span className="font-mono">{inr(r.amount)}</span> : '—'),
    },
    {
      key: 'outcome',
      label: 'Status',
      render: (r: BillRow) => {
        const b = outcomeBadge(r.outcome, preview?.dryRun ?? true);
        return (
          <span className="inline-flex items-center gap-2">
            <Badge variant={b.variant}>{b.label}</Badge>
            {r.outcome === 'no-active-pin' && (
              // Unfiltered on purpose: Pin Coverage resolves year-of-study
              // through a different function that disagrees with billing's, so a
              // pre-filtered link can land on a page missing this student.
              <Link to="/finance/fee-management/pin-coverage" className="text-xs text-primary-600 hover:underline">
                Fix →
              </Link>
            )}
            {r.error && <span className="text-xs text-red-600" title={r.error}>{r.error.slice(0, 40)}</span>}
          </span>
        );
      },
    },
  ];

  if (!canGenerate) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        You need the finance <strong>create</strong> permission to generate bills. This screen is for
        an admin / accounts operator — a principal (approve/read only) cannot bill.
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="mb-5 flex items-center gap-2">
        <Receipt size={20} className="text-primary-600" />
        <h2 className="text-xl font-bold text-navy">Generate Semester Bills</h2>
      </div>
      <p className="mb-5 text-sm text-gray-600">
        Bill pinned students for the chosen semester — each is charged their pinned annual fee split
        into a per-semester installment. Preview first: every student the run would touch is listed,
        and you choose who to bill. Re-running is safe; anyone already billed is skipped.
      </p>

      <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 md:grid-cols-5">
        <div>
          <label className={lbl} htmlFor="gb-semester">Semester *</label>
          <select id="gb-semester" value={filters.semesterId} onChange={(e) => setFilter('semesterId', e.target.value)} className={inp}>
            <option value="">Select…</option>
            {semesters.map((s) => (
              <option key={s._id} value={s._id}>
                Semester {s.number} — {s.year}{s.status ? ` (${s.status})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl} htmlFor="gb-programme">Programme</label>
          <select id="gb-programme" value={filters.programmeId} onChange={(e) => setFilter('programmeId', e.target.value)} className={inp}>
            <option value="">All</option>
            {programmes.map((p) => <option key={p._id} value={p._id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl} htmlFor="gb-branch">Branch</label>
          <select id="gb-branch" value={filters.branchId} onChange={(e) => setFilter('branchId', e.target.value)} className={inp}>
            <option value="">All</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.code}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl} htmlFor="gb-year">Year of study</label>
          <select id="gb-year" value={filters.yearOfStudy} onChange={(e) => setFilter('yearOfStudy', e.target.value)} className={inp}>
            <option value="">All years</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((y) => <option key={y} value={y}>Year {y}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl} htmlFor="gb-due">Due date</label>
          <input id="gb-due" type="date" value={filters.dueDate} onChange={(e) => setFilter('dueDate', e.target.value)} className={inp} />
          <p className="mt-1 text-xs text-gray-500">Blank = 30 days.</p>
        </div>
        <div className="md:col-span-5 flex justify-end">
          <button
            onClick={() => previewMut.mutate()}
            disabled={!filters.semesterId || previewMut.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {previewMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            Preview
          </button>
        </div>
      </div>

      {preview && (
        <div className="mt-6" data-testid="generate-bills-result">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-navy">
              {rows.length} student{rows.length === 1 ? '' : 's'} in scope
              {billable.length !== rows.length && ` · ${billable.length} billable`}
            </h3>
            <div className="flex items-center gap-3">
              {billable.length > 0 && (
                <button
                  onClick={() => setSelected(allBillableSelected ? new Set() : new Set(billable.map((r) => r.studentId)))}
                  className="text-xs text-primary-600 hover:underline"
                >
                  {allBillableSelected ? 'Clear selection' : 'Select all billable'}
                </button>
              )}
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or roll…"
                aria-label="Search students"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <DataTable
            columns={columns as never}
            data={visible}
            rowKey={(r: BillRow) => r.studentId}
            emptyMessage={
              rows.length === 0
                ? 'No pinned students match these filters — nothing would be billed.'
                : 'No student matches your search.'
            }
          />
        </div>
      )}

      <BillingHistory />

      {preview && rows.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white/95 px-6 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="text-sm text-gray-700">
              <strong data-testid="selected-count">{selected.size}</strong> of {billable.length} selected
              {' · '}
              <strong className="font-mono" data-testid="selected-total">{inr(selectedTotal)}</strong>
            </div>
            <button
              onClick={generate}
              disabled={selected.size === 0 || genMut.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {genMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Receipt size={15} />}
              Generate bills
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
