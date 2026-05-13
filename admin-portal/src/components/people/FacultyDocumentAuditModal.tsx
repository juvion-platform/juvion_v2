/**
 * FacultyDocumentAuditModal — timeline view of a single document's
 * audit history. Pulls from M11 audit log via
 * `GET /api/people/faculty/:facultyId/documents/:docId/audit`.
 *
 * Strategic Gap 1 Phase B4. Operators open this from the per-doc
 * action menu in `FacultyDocumentsPanel` to answer "who uploaded
 * this, who approved it, what changed when?" — the canonical NAAC
 * audit-trail question.
 */

import { useQuery } from '@tanstack/react-query';
import {
  Loader2, CheckCircle2, XCircle, Upload, Pencil, Trash2, AlertCircle,
  Clock, FileText,
} from 'lucide-react';

import Modal from '../ui/Modal';
import {
  getFacultyDocumentAuditHistory,
  FacultyDocumentAuditEntry,
} from '../../services/faculty-documents';

interface FacultyDocumentAuditModalProps {
  facultyId: string;
  docId: string;
  docTitle: string;
  open: boolean;
  onClose: () => void;
}

const ACTION_META: Record<string, { label: string; cls: string; Icon: typeof Upload }> = {
  create:  { label: 'Uploaded',        cls: 'bg-blue-50 text-blue-700 border-blue-200',           Icon: Upload },
  update:  { label: 'Metadata edited', cls: 'bg-slate-50 text-slate-700 border-slate-200',        Icon: Pencil },
  approve: { label: 'Approved',        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  reject:  { label: 'Rejected',        cls: 'bg-amber-50 text-amber-700 border-amber-200',       Icon: XCircle },
  archive: { label: 'Archived',        cls: 'bg-red-50 text-red-700 border-red-200',             Icon: Trash2 },
};

function ActionPill({ action }: { action: string }) {
  const meta = ACTION_META[action] ?? {
    label: action,
    cls: 'bg-gray-50 text-gray-700 border-gray-200',
    Icon: Clock,
  };
  const Icon = meta.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${meta.cls}`}>
      <Icon size={11} /> {meta.label}
    </span>
  );
}

export default function FacultyDocumentAuditModal({
  facultyId,
  docId,
  docTitle,
  open,
  onClose,
}: FacultyDocumentAuditModalProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['faculty-document-audit', facultyId, docId],
    queryFn: () => getFacultyDocumentAuditHistory(facultyId, docId),
    enabled: open && !!facultyId && !!docId,
  });
  const items: FacultyDocumentAuditEntry[] = data?.items ?? [];

  return (
    <Modal open={open} onClose={onClose} title={`History — ${docTitle}`} widthClass="max-w-2xl">
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 p-4">
          <Loader2 size={14} className="animate-spin" /> Loading history…
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          Couldn't load audit history. {(error as any)?.message ?? ''}
        </div>
      )}
      {!isLoading && !error && items.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 flex items-start gap-2">
          <FileText size={14} className="mt-0.5 flex-shrink-0" />
          No audit entries yet. (This is unusual — every upload should
          write one. Check the audit log directly if you see this on a
          populated doc.)
        </div>
      )}
      {items.length > 0 && (
        <ol className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
          {items.map((entry) => (
            <li key={entry._id} className="border-l-2 border-gray-200 pl-3 py-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <ActionPill action={entry.action} />
                <time className="text-xs text-gray-500" title={entry.timestamp}>
                  {new Date(entry.timestamp).toLocaleString()}
                </time>
              </div>
              <div className="mt-1 text-xs text-gray-700">
                by <span className="font-mono">{entry.performedBy || 'system'}</span>
              </div>
              {entry.changes && entry.changes.length > 0 && (
                <ul className="mt-1 text-xs text-gray-600 space-y-0.5">
                  {entry.changes.map((c, i) => (
                    <li key={i}>
                      <span className="font-mono">{c.field ?? '?'}</span>
                      {': '}
                      <span className="line-through text-gray-400">{String(c.oldValue ?? '')}</span>
                      {' → '}
                      <span>{String(c.newValue ?? '')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
