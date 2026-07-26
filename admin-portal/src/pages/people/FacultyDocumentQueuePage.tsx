/**
 * FacultyDocumentQueuePage — admin "needs verification" queue.
 *
 * Lists every faculty-credential document with
 * `verificationStatus = 'pending'` across the entire college,
 * oldest-first so the queue drains FIFO. Each row carries inline
 * View / Approve / Reject actions so an admin can clear the queue
 * without navigating into individual faculty pages.
 *
 * Strategic Gap 1 Phase B3. Backend endpoint:
 *   GET /api/people/faculty-document-queue
 *   POST /api/people/faculty/:facultyId/documents/:docId/approve
 *   POST /api/people/faculty/:facultyId/documents/:docId/reject
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, Clock, ExternalLink, AlertCircle, Loader2, Check, X,
  Filter, AlertTriangle,
} from 'lucide-react';

import DataTable from '../../components/ui/DataTable';
import { confirmAction } from '../../stores/confirmStore';
import {
  listPendingFacultyDocuments,
  approveFacultyDocument,
  rejectFacultyDocument,
  bulkApproveFacultyDocuments,
  bulkRejectFacultyDocuments,
  getFacultyDocumentViewUrl,
  PendingFacultyDoc,
  FacultyDocumentCategory,
} from '../../services/faculty-documents';

const CATEGORY_LABELS: Record<FacultyDocumentCategory, string> = {
  identity: 'Identity',
  education: 'Education',
  certification: 'Certification',
  experience: 'Experience',
  current_employment: 'Employment',
  research: 'Research',
  training: 'Training',
  award: 'Award',
  membership: 'Membership',
  administrative: 'Administrative',
  hr_payroll: 'HR / Payroll',
  self_declaration: 'Self declaration',
};

function getFacultyDisplay(doc: PendingFacultyDoc): { name: string; employeeCode: string; facultyId: string } {
  const f = doc.facultyId;
  if (typeof f === 'string') {
    return { name: '—', employeeCode: '', facultyId: f };
  }
  return {
    name: f.personId?.name ?? '—',
    employeeCode: f.employeeCode ?? '',
    facultyId: f._id,
  };
}

/**
 * Compute days-pending from `createdAt`. Used to drive SLA badges:
 *   - >7 days  → amber  (queue is starting to age)
 *   - >30 days → red    (escalation territory)
 */
function daysPending(createdAt?: string): number {
  if (!createdAt) return 0;
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

type SlaBadge = 'fresh' | 'aging' | 'overdue';
function slaBadgeFor(days: number): SlaBadge {
  if (days > 30) return 'overdue';
  if (days > 7) return 'aging';
  return 'fresh';
}

const SLA_BADGE_META: Record<SlaBadge, { cls: string; label: (d: number) => string } | null> = {
  fresh:   null, // no badge for fresh items — only show when aging/overdue
  aging:   { cls: 'bg-amber-50 text-amber-800 border-amber-200', label: (d) => `${d}d pending` },
  overdue: { cls: 'bg-red-50 text-red-800 border-red-200',       label: (d) => `${d}d — overdue` },
};

export default function FacultyDocumentQueuePage() {
  const qc = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<FacultyDocumentCategory | ''>('');
  const [slaFilter, setSlaFilter] = useState<'' | 'aging_or_worse' | 'overdue'>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['faculty-document-queue'],
    queryFn: listPendingFacultyDocuments,
  });

  const allItems = data?.items ?? [];
  const items = useMemo(() => {
    return allItems.filter((d) => {
      if (categoryFilter && d.category !== categoryFilter) return false;
      if (slaFilter) {
        const days = daysPending(d.createdAt);
        if (slaFilter === 'overdue' && days <= 30) return false;
        if (slaFilter === 'aging_or_worse' && days <= 7) return false;
      }
      return true;
    });
  }, [allItems, categoryFilter, slaFilter]);

  // Count per category — drives the filter chip badges so the admin
  // can see queue depth per evidence type at a glance.
  const byCategory = new Map<FacultyDocumentCategory, number>();
  for (const d of allItems) {
    byCategory.set(d.category, (byCategory.get(d.category) ?? 0) + 1);
  }

  // SLA counts. Drives the SLA filter chips ("Aging 5", "Overdue 2").
  let agingCount = 0;
  let overdueCount = 0;
  for (const d of allItems) {
    const days = daysPending(d.createdAt);
    if (days > 30) overdueCount += 1;
    else if (days > 7) agingCount += 1;
  }

  // Selection sync — drop any selected ids that disappear from the
  // current filter view (so a stale id can't sneak into a bulk action).
  const visibleIds = new Set(items.map((d) => d._id));
  const selectedVisible = Array.from(selectedIds).filter((id) => visibleIds.has(id));
  const allVisibleSelected = items.length > 0 && selectedVisible.length === items.length;

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }

  const approveMut = useMutation({
    mutationFn: ({ facultyId, docId }: { facultyId: string; docId: string }) =>
      approveFacultyDocument(facultyId, docId),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['faculty-document-queue'] });
      // Also bust the per-faculty docs cache so the detail page reflects.
    },
    onError: (e: any) => setError(e?.response?.data?.error || e?.message || 'Approve failed'),
  });
  const rejectMut = useMutation({
    mutationFn: ({ facultyId, docId, reason }: { facultyId: string; docId: string; reason: string }) =>
      rejectFacultyDocument(facultyId, docId, reason),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['faculty-document-queue'] });
    },
    onError: (e: any) => setError(e?.response?.data?.error || e?.message || 'Reject failed'),
  });

  const bulkApproveMut = useMutation({
    mutationFn: (docIds: string[]) => bulkApproveFacultyDocuments(docIds),
    onSuccess: (result) => {
      setError(null);
      clearSelection();
      qc.invalidateQueries({ queryKey: ['faculty-document-queue'] });
      if (result.failures.length > 0) {
        setError(`Approved ${result.approved}, failed ${result.failures.length}. First error: ${result.failures[0]?.error}`);
      }
    },
    onError: (e: any) => setError(e?.response?.data?.error || e?.message || 'Bulk approve failed'),
  });
  const bulkRejectMut = useMutation({
    mutationFn: ({ docIds, reason }: { docIds: string[]; reason: string }) =>
      bulkRejectFacultyDocuments(docIds, reason),
    onSuccess: (result) => {
      setError(null);
      clearSelection();
      qc.invalidateQueries({ queryKey: ['faculty-document-queue'] });
      if (result.failures.length > 0) {
        setError(`Rejected ${result.rejected}, failed ${result.failures.length}. First error: ${result.failures[0]?.error}`);
      }
    },
    onError: (e: any) => setError(e?.response?.data?.error || e?.message || 'Bulk reject failed'),
  });

  async function handleBulkApprove() {
    const ids = selectedVisible;
    if (ids.length === 0) return;
    const ok = await confirmAction({
      title: `Mark ${ids.length} document${ids.length === 1 ? '' : 's'} as verified?`,
      message: 'This writes one audit-log entry per doc.',
      confirmLabel: 'Mark verified',
    });
    if (!ok.confirmed) return;
    bulkApproveMut.mutate(ids);
  }

  async function handleBulkReject() {
    const ids = selectedVisible;
    if (ids.length === 0) return;
    const res = await confirmAction({
      title: `Reject ${ids.length} document${ids.length === 1 ? '' : 's'}?`,
      message: 'The reason below is applied verbatim to every selected document.',
      tone: 'danger',
      confirmLabel: 'Reject',
      requireReason: true,
      reasonLabel: 'Shared rejection reason',
    });
    if (!res.confirmed || !res.reason) return;
    bulkRejectMut.mutate({ docIds: ids, reason: res.reason });
  }

  async function handleView(doc: PendingFacultyDoc) {
    try {
      const { facultyId } = getFacultyDisplay(doc);
      const { url } = await getFacultyDocumentViewUrl(facultyId, doc._id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Could not generate view URL');
    }
  }

  async function handleApprove(doc: PendingFacultyDoc) {
    const ok = await confirmAction({
      title: `Mark "${doc.title}" as verified?`,
      message: 'This creates an audit-log entry.',
      confirmLabel: 'Mark verified',
    });
    if (!ok.confirmed) return;
    const { facultyId } = getFacultyDisplay(doc);
    approveMut.mutate({ facultyId, docId: doc._id });
  }

  async function handleReject(doc: PendingFacultyDoc) {
    const res = await confirmAction({
      title: `Reject "${doc.title}"?`,
      message: 'The reason is shown to the faculty member so they know what to fix on re-upload.',
      tone: 'danger',
      confirmLabel: 'Reject',
      requireReason: true,
      reasonLabel: 'Rejection reason',
    });
    if (!res.confirmed || !res.reason) return;
    const { facultyId } = getFacultyDisplay(doc);
    rejectMut.mutate({ facultyId, docId: doc._id, reason: res.reason });
  }

  const columns = [
    {
      // Header is a "select all visible" master checkbox; cells are
      // per-row checkboxes. Kept in column 0 so the rest of the table
      // layout stays scannable.
      key: 'select',
      label: (
        <input
          type="checkbox"
          aria-label="Select all visible"
          checked={allVisibleSelected}
          // indeterminate prop set via ref on focus; React doesn't
          // proxy it directly, but for ≤ small queues a simple
          // toggle is enough.
          onChange={toggleAllVisible}
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
      ) as unknown as string,
      render: (d: PendingFacultyDoc) => (
        <input
          type="checkbox"
          aria-label={`Select ${d.title}`}
          checked={selectedIds.has(d._id)}
          onChange={(e) => { e.stopPropagation(); toggleOne(d._id); }}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
      ),
    },
    {
      key: 'faculty',
      label: 'Faculty',
      render: (d: PendingFacultyDoc) => {
        const { name, employeeCode, facultyId } = getFacultyDisplay(d);
        return (
          <Link to={`/people/faculty/${facultyId}`} className="block">
            <div className="font-medium text-navy">{name}</div>
            {employeeCode && <div className="text-xs text-gray-500 font-mono">{employeeCode}</div>}
          </Link>
        );
      },
    },
    {
      key: 'title',
      label: 'Document',
      render: (d: PendingFacultyDoc) => (
        <div>
          <div className="font-medium text-gray-800">{d.title}</div>
          <div className="text-xs text-gray-500 font-mono">{d.documentType}</div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (d: PendingFacultyDoc) => (
        <span className="text-xs text-gray-700">{CATEGORY_LABELS[d.category]}</span>
      ),
    },
    {
      key: 'uploaded',
      label: 'Uploaded',
      render: (d: PendingFacultyDoc) => {
        const days = daysPending(d.createdAt);
        const slaMeta = SLA_BADGE_META[slaBadgeFor(days)];
        return (
          <div className="space-y-0.5">
            <div className="text-xs text-gray-500">
              {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}
            </div>
            {slaMeta && (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${slaMeta.cls}`}>
                <AlertTriangle size={9} /> {slaMeta.label(days)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (_d: PendingFacultyDoc) => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border bg-amber-50 text-amber-800 border-amber-200">
          <Clock size={10} /> Pending
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (d: PendingFacultyDoc) => (
        <div className="flex gap-1 justify-end">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleView(d); }}
            title="View"
            className="p-1.5 rounded hover:bg-primary-50 text-primary-700"
          >
            <ExternalLink size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleApprove(d); }}
            title="Approve"
            className="p-1.5 rounded hover:bg-emerald-50 text-emerald-700"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleReject(d); }}
            title="Reject (requires reason)"
            className="p-1.5 rounded hover:bg-amber-50 text-amber-700"
          >
            <X size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy">Faculty Document Verification Queue</h2>
          <p className="text-sm text-gray-500 mt-1">
            {allItems.length === 0
              ? 'All caught up — no documents pending verification.'
              : `${allItems.length} document${allItems.length === 1 ? '' : 's'} awaiting verification, oldest first.`}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-amber-600">{allItems.length}</div>
          <div className="text-xs text-gray-500">in queue</div>
        </div>
      </div>

      {/* Category filter chips */}
      {byCategory.size > 0 && (
        <div className="mb-3 flex items-center flex-wrap gap-2">
          <Filter size={14} className="text-gray-400" />
          <button
            type="button"
            onClick={() => setCategoryFilter('')}
            className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
              !categoryFilter
                ? 'bg-primary-50 text-primary-700 border-primary-200'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            All ({allItems.length})
          </button>
          {Array.from(byCategory.entries()).map(([cat, count]) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                categoryFilter === cat
                  ? 'bg-primary-50 text-primary-700 border-primary-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {CATEGORY_LABELS[cat]} ({count})
            </button>
          ))}
        </div>
      )}

      {/* SLA filter chips — show when at least one row is past 7 days */}
      {(agingCount > 0 || overdueCount > 0) && (
        <div className="mb-4 flex items-center flex-wrap gap-2">
          <AlertTriangle size={14} className="text-amber-500" />
          <span className="text-xs text-gray-600 font-medium">Age:</span>
          <button
            type="button"
            onClick={() => setSlaFilter('')}
            className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
              !slaFilter
                ? 'bg-primary-50 text-primary-700 border-primary-200'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            All ages
          </button>
          <button
            type="button"
            onClick={() => setSlaFilter('aging_or_worse')}
            className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
              slaFilter === 'aging_or_worse'
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
            }`}
          >
            7d+ pending ({agingCount + overdueCount})
          </button>
          <button
            type="button"
            onClick={() => setSlaFilter('overdue')}
            className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
              slaFilter === 'overdue'
                ? 'bg-red-100 text-red-800 border-red-300'
                : 'bg-white text-red-700 border-red-200 hover:bg-red-50'
            }`}
          >
            Overdue 30d+ ({overdueCount})
          </button>
        </div>
      )}

      {/* Bulk-action toolbar — appears when any visible row is selected */}
      {selectedVisible.length > 0 && (
        <div className="mb-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 flex items-center justify-between gap-3">
          <div className="text-sm text-primary-900">
            <span className="font-semibold">{selectedVisible.length}</span> selected
            {selectedIds.size > selectedVisible.length && (
              <span className="text-xs text-primary-700 ml-1">
                ({selectedIds.size - selectedVisible.length} hidden by filter)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBulkApprove}
              disabled={bulkApproveMut.isPending}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 disabled:opacity-50"
            >
              {bulkApproveMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Approve {selectedVisible.length}
            </button>
            <button
              type="button"
              onClick={handleBulkReject}
              disabled={bulkRejectMut.isPending}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200 disabled:opacity-50"
            >
              {bulkRejectMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
              Reject {selectedVisible.length}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-primary-700 hover:text-primary-900 px-2 py-1"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading queue…
        </div>
      ) : allItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-emerald-50/40 rounded-xl border border-emerald-200">
          <CheckCircle2 size={36} className="text-emerald-500 mb-2" />
          <div className="text-lg font-medium text-emerald-900">All caught up</div>
          <div className="text-sm text-emerald-700 mt-1">
            No faculty-credential documents are pending verification.
          </div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          loading={false}
          rowKey={(d: PendingFacultyDoc) => d._id}
          emptyState={`No ${categoryFilter ? CATEGORY_LABELS[categoryFilter] : ''} documents match the current filter.`}
        />
      )}
    </div>
  );
}
