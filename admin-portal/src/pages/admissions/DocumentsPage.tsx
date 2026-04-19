import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listDocumentChecklists} from '../../services/admissions';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';


const STATUS_COLOR: Record<string, string> = { pending: 'warning', partial: 'info', complete: 'success', verified: 'success' };
const STATUSES = ['pending', 'partial', 'complete', 'verified'] as const;

export default function DocumentsPage() {
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');

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

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Document Verification</h2>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
