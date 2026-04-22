/**
 * FinancialHoldsPage — Admin UI for the pending-hold approval workflow.
 * (fee-collection-analytics-and-alerts / Task 10)
 *
 * Journey 4 (spec §Journey 4): holds are auto-raised as `pending_approval`
 * when a student's cron advance lands on `stage_4` (T5). A Principal must
 * review and either Activate (blocks exam-clearance) or Waive (with a
 * reason). This page is the Principal's inbox for those decisions.
 *
 * Endpoints consumed (T8):
 *   - GET  /api/finance/holds
 *   - POST /api/finance/holds/:id/activate
 *   - POST /api/finance/holds/:id/waive
 *
 * v1 known limitation: the list endpoint returns raw `IFinancialHold`
 * documents with ObjectId refs — no join to Student / Programme / overdue
 * ₹ / days-overdue. The UI surfaces student IDs as click-through links to
 * `/people/students/:id`. A v2 follow-up will enrich the list response
 * via server-side `$lookup`s.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Gavel,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';

import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import {
  activateHold,
  FinancialHold,
  HoldStatus,
  HoldType,
  listHolds,
  waiveHold,
} from '../../services/fee-holds';
import { useAuthStore } from '../../stores/authStore';

// ─── UI constants ────────────────────────────────────────────────
const inp =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';

type TabKey = 'pending_approval' | 'active' | 'released' | 'all';

interface TabDef {
  key: TabKey;
  label: string;
  /** Server `status` filter. `undefined` for "All". */
  status?: HoldStatus;
}

const TABS: TabDef[] = [
  { key: 'pending_approval', label: 'Pending Approval', status: 'pending_approval' },
  { key: 'active', label: 'Active', status: 'active' },
  { key: 'released', label: 'Released', status: 'released' },
  { key: 'all', label: 'All' },
];

const HOLD_TYPE_OPTIONS: Array<{ value: HoldType | ''; label: string }> = [
  { value: '', label: 'All hold types' },
  { value: 'exam_debarment', label: 'Exam debarment' },
  { value: 'hostel_restriction', label: 'Hostel restriction' },
  { value: 'transcript_hold', label: 'Transcript hold' },
  { value: 'full_clearance_block', label: 'Full clearance block' },
];

const HOLD_TYPE_LABEL: Record<HoldType, string> = {
  exam_debarment: 'Exam debarment',
  hostel_restriction: 'Hostel restriction',
  transcript_hold: 'Transcript hold',
  full_clearance_block: 'Full clearance block',
};

function statusBadge(status: HoldStatus) {
  if (status === 'pending_approval') return <Badge variant="warning">Pending approval</Badge>;
  if (status === 'active') return <Badge variant="danger">Active</Badge>;
  return <Badge variant="default">Released</Badge>;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

// ─── Inline toast (no external lib per task constraints) ─────────
interface ToastState {
  kind: 'success' | 'error';
  message: string;
}

function InlineToast({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  if (!toast) return null;
  const kind = toast.kind;
  const cls =
    kind === 'success'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
      : 'bg-red-50 border-red-200 text-red-800';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 right-4 z-[60] max-w-sm rounded-lg border px-4 py-3 shadow-lg ${cls}`}
    >
      <div className="flex items-start gap-2">
        {kind === 'success' ? <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" /> : <ShieldAlert size={18} className="mt-0.5 flex-shrink-0" />}
        <div className="flex-1 text-sm font-medium">{toast.message}</div>
        <button type="button" onClick={onDismiss} className="p-0.5 rounded hover:bg-black/5" aria-label="Dismiss">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────
export default function FinancialHoldsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canApprove = useAuthStore(s => s.hasPermission('finance', 'update'));

  const [tab, setTab] = useState<TabKey>('pending_approval');
  const [holdTypeFilter, setHoldTypeFilter] = useState<HoldType | ''>('');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);

  // Dialog state
  const [activateTarget, setActivateTarget] = useState<FinancialHold | null>(null);
  const [waiveTarget, setWaiveTarget] = useState<FinancialHold | null>(null);
  const [waiveReason, setWaiveReason] = useState('');

  const activeTab = TABS.find(t => t.key === tab) ?? TABS[0]!;

  const listQuery = useQuery({
    // Include tab in key so cached pages for different tabs don't collide.
    queryKey: ['finance-holds', activeTab.key],
    queryFn: () => listHolds({ status: activeTab.status, limit: 100 }),
    staleTime: 30 * 1000,
  });

  // Separate query so the header badge stays accurate even when the user
  // is on a different tab. Cheap: the endpoint is indexed on status.
  const pendingCountQuery = useQuery({
    queryKey: ['finance-holds', 'pending-count'],
    queryFn: () => listHolds({ status: 'pending_approval', limit: 1 }),
    staleTime: 30 * 1000,
  });
  const pendingCount = pendingCountQuery.data?.total ?? 0;

  const activateMut = useMutation({
    mutationFn: (holdId: string) => activateHold(holdId),
    onSuccess: () => {
      setToast({ kind: 'success', message: 'Hold activated. Student cannot take exams until released.' });
      setActivateTarget(null);
      qc.invalidateQueries({ queryKey: ['finance-holds'] });
    },
    onError: (err: unknown) => {
      setToast({ kind: 'error', message: errorMessage(err, 'Failed to activate hold') });
    },
  });

  const waiveMut = useMutation({
    mutationFn: (vars: { holdId: string; reason: string }) => waiveHold(vars.holdId, vars.reason),
    onSuccess: () => {
      setToast({ kind: 'success', message: 'Hold waived.' });
      setWaiveTarget(null);
      setWaiveReason('');
      qc.invalidateQueries({ queryKey: ['finance-holds'] });
    },
    onError: (err: unknown) => {
      setToast({ kind: 'error', message: errorMessage(err, 'Failed to waive hold') });
    },
  });

  // Client-side filters. Server returns up to 100; v1 is a small dataset.
  const rows = useMemo(() => {
    const all = listQuery.data?.items ?? [];
    const needle = search.trim().toLowerCase();
    return all.filter(h => {
      if (holdTypeFilter && h.holdType !== holdTypeFilter) return false;
      if (needle) {
        const hay = `${h.studentId} ${h.holdType} ${h.holdStatus}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [listQuery.data, holdTypeFilter, search]);

  const totalForTab = listQuery.data?.total ?? 0;

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="min-w-[1024px] lg:min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <button
            onClick={() => navigate('/finance')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            <ArrowLeft size={16} className="text-gray-400" /> Back to Finance
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-navy">Financial Holds</h2>
            {pendingCount > 0 && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 px-2.5 py-1 text-xs font-semibold"
                title="Holds awaiting Principal approval"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                {pendingCount} awaiting approval
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Review cron-raised holds from stage_4 students. Activate to block exam clearance, or waive with a reason.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            listQuery.refetch();
            pendingCountQuery.refetch();
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
          title="Refresh"
        >
          <RefreshCw size={14} className={listQuery.isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur border-b border-gray-200 -mx-2 px-2 mb-4">
        <nav className="flex gap-1 overflow-x-auto" role="tablist">
          {TABS.map(t => {
            const isActive = tab === t.key;
            const showDot = t.key === 'pending_approval' && pendingCount > 0;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(t.key)}
                className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary-500 text-primary-700'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                {t.label}
                {showDot && (
                  <span
                    className="absolute top-2 right-1 inline-block h-2 w-2 rounded-full bg-red-500"
                    aria-label="Pending items"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Filters row */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px_auto] gap-3 mb-4 items-center">
        <input
          type="text"
          placeholder="Search by student ID, hold type, status…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={inp}
        />
        <select
          value={holdTypeFilter}
          onChange={e => setHoldTypeFilter(e.target.value as HoldType | '')}
          className={inp}
        >
          {HOLD_TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="text-sm text-gray-500 whitespace-nowrap">
          Showing <span className="font-semibold text-navy">{rows.length}</span>
          {rows.length !== totalForTab && <> of {totalForTab}</>} hold{totalForTab === 1 ? '' : 's'}
        </div>
      </div>

      {/* Read-only banner for non-approvers */}
      {!canApprove && (
        <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs px-3 py-2">
          You have read-only access to holds. Only Principals (and super-admins) can Activate or Waive.
        </div>
      )}

      {/* Error banner */}
      {listQuery.isError && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          Failed to load holds. {errorMessage(listQuery.error, 'Please retry.')}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-xl border shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left text-gray-600">
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Hold Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Effective</th>
              <th className="px-4 py-3 font-medium">Raised</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {listQuery.isLoading ? (
              <SkeletonRows />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  {emptyMessageFor(tab, listQuery.isError)}
                </td>
              </tr>
            ) : (
              rows.map(h => (
                <tr key={h._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/people/students/${h.studentId}`}
                      className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 hover:underline font-mono text-xs"
                      title="Open student record"
                    >
                      {shortId(h.studentId)} <ExternalLink size={11} />
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-gray-800">
                      <Gavel size={14} className="text-gray-400" />
                      {HOLD_TYPE_LABEL[h.holdType]}
                    </span>
                  </td>
                  <td className="px-4 py-3">{statusBadge(h.holdStatus)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(h.effectiveDate)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(h.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <RowActions
                      hold={h}
                      canApprove={canApprove}
                      isBusy={activateMut.isPending || waiveMut.isPending}
                      onActivate={() => setActivateTarget(h)}
                      onWaive={() => {
                        setWaiveTarget(h);
                        setWaiveReason('');
                      }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* v1 limitation note */}
      <p className="text-xs text-gray-400 mt-3">
        v1: the list shows student IDs + hold metadata only. Click a student ID to open their full record.
        Student name, programme, overdue amount &amp; days-overdue enrichment lands in v2 via server-side
        <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 font-mono">$lookup</code>.
      </p>

      {/* Activate dialog */}
      <Modal
        open={!!activateTarget}
        onClose={() => !activateMut.isPending && setActivateTarget(null)}
        title="Activate this hold?"
      >
        {activateTarget && (
          <div className="space-y-4">
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2.5">
              <div className="font-semibold mb-1">This will block the student from taking exams.</div>
              <div className="text-xs text-red-700">
                The Clearance module reads `FinancialHold.holdStatus === 'active'` to gate exam eligibility.
              </div>
            </div>
            <dl className="text-sm grid grid-cols-[140px_1fr] gap-y-1.5">
              <dt className="text-gray-500">Student ID</dt>
              <dd className="font-mono text-xs">{activateTarget.studentId}</dd>
              <dt className="text-gray-500">Hold type</dt>
              <dd>{HOLD_TYPE_LABEL[activateTarget.holdType]}</dd>
              <dt className="text-gray-500">Raised</dt>
              <dd>{formatDate(activateTarget.createdAt)}</dd>
            </dl>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setActivateTarget(null)}
                disabled={activateMut.isPending}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => activateMut.mutate(activateTarget._id)}
                disabled={activateMut.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                <ShieldAlert size={14} />
                {activateMut.isPending ? 'Activating…' : 'Activate hold'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Waive dialog */}
      <Modal
        open={!!waiveTarget}
        onClose={() => !waiveMut.isPending && setWaiveTarget(null)}
        title="Waive this hold?"
      >
        {waiveTarget && (
          <form
            onSubmit={e => {
              e.preventDefault();
              const trimmed = waiveReason.trim();
              if (!trimmed) return;
              waiveMut.mutate({ holdId: waiveTarget._id, reason: trimmed });
            }}
            className="space-y-4"
          >
            <p className="text-sm text-gray-700">
              Waiving releases this hold. Provide a reason — the audit log records who waived, when, and why.
            </p>
            <dl className="text-sm grid grid-cols-[140px_1fr] gap-y-1.5">
              <dt className="text-gray-500">Student ID</dt>
              <dd className="font-mono text-xs">{waiveTarget.studentId}</dd>
              <dt className="text-gray-500">Hold type</dt>
              <dd>{HOLD_TYPE_LABEL[waiveTarget.holdType]}</dd>
              <dt className="text-gray-500">Current status</dt>
              <dd>{statusBadge(waiveTarget.holdStatus)}</dd>
            </dl>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="waive-reason">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                id="waive-reason"
                required
                minLength={1}
                value={waiveReason}
                onChange={e => setWaiveReason(e.target.value)}
                placeholder="e.g. Student paid in full today; scholarship approved; …"
                rows={4}
                className={inp}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setWaiveTarget(null)}
                disabled={waiveMut.isPending}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={waiveMut.isPending || !waiveReason.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                <CheckCircle2 size={14} />
                {waiveMut.isPending ? 'Waiving…' : 'Waive hold'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <InlineToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

// ─── Row actions ─────────────────────────────────────────────────
interface RowActionsProps {
  hold: FinancialHold;
  canApprove: boolean;
  isBusy: boolean;
  onActivate: () => void;
  onWaive: () => void;
}

function RowActions({ hold, canApprove, isBusy, onActivate, onWaive }: RowActionsProps) {
  if (!canApprove) {
    return <span className="text-xs text-gray-400">Read only</span>;
  }
  if (hold.holdStatus === 'released') {
    return <span className="text-xs text-gray-400">—</span>;
  }
  if (hold.holdStatus === 'pending_approval') {
    return (
      <div className="inline-flex gap-1.5">
        <button
          type="button"
          onClick={onActivate}
          disabled={isBusy}
          className="px-2.5 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1"
          title="Activate this hold (blocks exam clearance)"
        >
          <ShieldAlert size={12} /> Activate
        </button>
        <button
          type="button"
          onClick={onWaive}
          disabled={isBusy}
          className="px-2.5 py-1 text-xs bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-1"
          title="Waive this hold"
        >
          <CheckCircle2 size={12} /> Waive
        </button>
      </div>
    );
  }
  // active
  return (
    <button
      type="button"
      onClick={onWaive}
      disabled={isBusy}
      className="px-2.5 py-1 text-xs bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-1"
      title="Waive this hold"
    >
      <CheckCircle2 size={12} /> Waive
    </button>
  );
}

// ─── Skeleton loading rows ───────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: 6 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-3 rounded bg-gray-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────
function emptyMessageFor(tab: TabKey, isError: boolean): string {
  if (isError) return 'Could not load holds.';
  if (tab === 'pending_approval') return 'No holds pending approval. All caught up.';
  if (tab === 'active') return 'No active holds.';
  if (tab === 'released') return 'No released holds yet.';
  return 'No holds found.';
}

function errorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === 'object' && err !== null) {
    const e = err as { response?: { data?: { message?: string } }; message?: string };
    return e.response?.data?.message || e.message || fallback;
  }
  return fallback;
}
