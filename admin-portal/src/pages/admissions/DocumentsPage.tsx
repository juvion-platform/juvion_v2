import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listDocumentChecklists} from '../../services/admissions';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useViewEditMode } from '../../hooks/useViewEditMode';


const STATUS_COLOR: Record<string, string> = { pending: 'warning', partial: 'info', complete: 'success', verified: 'success' };
const STATUSES = ['pending', 'partial', 'complete', 'verified'] as const;

export default function DocumentsPage() {
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');

  const vem = useViewEditMode<any>();

  const { data, isLoading } = useQuery({
    queryKey: ['doc-checklists', page, filterStatus],
    queryFn: () => listDocumentChecklists(page, 20, filterStatus || undefined),
  });

  const columns = [
    { key: 'applicantId', label: 'Applicant', render: (r: any) => r.applicantId?.name || r.applicantId?.email || '\u2014' },
    { key: 'documents', label: 'Documents', render: (r: any) => {
      const docs = r.documents || [];
      const uploaded = docs.filter((d: any) => d.uploaded).length;
      const verified = docs.filter((d: any) => d.verified).length;
      return <span className="text-sm">{uploaded}/{docs.length} uploaded, {verified} verified</span>;
    }},
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status]}>{r.status}</Badge> },
    { key: 'updatedAt', label: 'Last Updated', render: (r: any) => new Date(r.updatedAt).toLocaleDateString() },
  ];

  const selected = vem.entity;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Document Verification</h2>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
      />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Document Checklist')}>
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <div className="text-gray-500">Applicant</div>
                <div className="font-medium text-navy">{selected.applicantId?.name || selected.applicantId?.email || '—'}</div>
              </div>
              <Badge variant={STATUS_COLOR[selected.status]}>{selected.status}</Badge>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-500 mb-2">Documents</h4>
              {(selected.documents || []).length === 0 ? (
                <p className="text-sm text-gray-500">No documents on file.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {(selected.documents || []).map((d: any, idx: number) => (
                    <li key={d._id || d.name || idx} className="flex items-center justify-between border-b last:border-b-0 py-1">
                      <span>{d.name || d.type || '—'}</span>
                      <span className="flex gap-2">
                        <Badge variant={d.uploaded ? 'success' : 'default'}>{d.uploaded ? 'uploaded' : 'missing'}</Badge>
                        <Badge variant={d.verified ? 'success' : 'default'}>{d.verified ? 'verified' : 'unverified'}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="text-xs text-gray-500">Last updated: {new Date(selected.updatedAt).toLocaleString()}</div>

            <div className="flex justify-end gap-3 pt-2 border-t">
              <button type="button" onClick={vem.close} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
