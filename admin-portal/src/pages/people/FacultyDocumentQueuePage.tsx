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

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, Clock, ExternalLink, AlertCircle, Loader2, Check, X,
  Filter,
} from 'lucide-react';

import DataTable from '../../components/ui/DataTable';
import {
  listPendingFacultyDocuments,
  approveFacultyDocument,
  rejectFacultyDocument,
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

export default function FacultyDocumentQueuePage() {
  const qc = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<FacultyDocumentCategory | ''>('');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['faculty-document-queue'],
    queryFn: listPendingFacultyDocuments,
  });

  const allItems = data?.items ?? [];
  const items = categoryFilter
    ? allItems.filter((d) => d.category === categoryFilter)
    : allItems;

  // Count per category — drives the filter chip badges so the admin
  // can see queue depth per evidence type at a glance.
  const byCategory = new Map<FacultyDocumentCategory, number>();
  for (const d of allItems) {
    byCategory.set(d.category, (byCategory.get(d.category) ?? 0) + 1);
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

  async function handleView(doc: PendingFacultyDoc) {
    try {
      const { facultyId } = getFacultyDisplay(doc);
      const { url } = await getFacultyDocumentViewUrl(facultyId, doc._id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Could not generate view URL');
    }
  }

  function handleApprove(doc: PendingFacultyDoc) {
    if (!window.confirm(`Mark "${doc.title}" as verified? This creates an audit-log entry.`)) return;
    const { facultyId } = getFacultyDisplay(doc);
    approveMut.mutate({ facultyId, docId: doc._id });
  }

  function handleReject(doc: PendingFacultyDoc) {
    const reason = window.prompt(
      `Reject "${doc.title}"?\n\nProvide a reason so the faculty member knows what to fix on re-upload:`,
      '',
    );
    if (!reason || !reason.trim()) return;
    const { facultyId } = getFacultyDisplay(doc);
    rejectMut.mutate({ facultyId, docId: doc._id, reason: reason.trim() });
  }

  const columns = [
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
      render: (d: PendingFacultyDoc) => (
        <span className="text-xs text-gray-500">
          {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}
        </span>
      ),
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
        <div className="mb-4 flex items-center flex-wrap gap-2">
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
