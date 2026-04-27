import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listStaff, deleteStaff } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import PersonThumbnail from '../../components/people/PersonThumbnail';
import { useHighlightRow } from '../../hooks/useHighlightRow';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = { active: 'success', on_leave: 'warning', separated: 'danger' };
const STATUSES = ['active', 'on_leave', 'separated'] as const;

export default function StaffPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['staff', page, filterStatus, search],
    queryFn: () => listStaff(page, 20, filterStatus || undefined, search || undefined),
  });

  // Consume ?highlight=<personId> from global-people-search: scrolls to + flashes
  // the matching row once data is loaded.
  const { highlightAttrs } = useHighlightRow({ ready: !isLoading && Boolean(data) });

  const deleteMut = useMutation({
    mutationFn: deleteStaff,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); qc.invalidateQueries({ queryKey: ['people-stats'] }); },
  });

  const columns = [
    { key: 'photo', label: '', render: (r: any) => {
      const name = r.person?.name || r.personId?.name || undefined;
      return <PersonThumbnail entityType="staff" entityId={r._id} personName={name} />;
    } },
    { key: 'employeeCode', label: 'Emp Code' },
    { key: 'name', label: 'Name', render: (r: any) => (r.person?.name || r.personId?.name || '—') },
    { key: 'phone', label: 'Phone', render: (r: any) => (r.person?.phone || r.personId?.phone || '—') },
    { key: 'designation', label: 'Designation' },
    { key: 'department', label: 'Department', render: (r: any) => r.department?.name || '—' },
    { key: 'staffType', label: 'Type' },
    { key: 'profileCompleteness', label: 'Profile', render: (r: any) => {
      const score = r.profileCompleteness;
      if (!score) return '—';
      return (
        <div title={score.missing?.length ? `Missing: ${score.missing.join(', ')}` : 'Profile complete'}>
          <Badge variant={score.status === 'complete' ? 'success' : score.status === 'progressing' ? 'warning' : 'default'}>
            {score.percent}% complete
          </Badge>
        </div>
      );
    } },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status]}>{r.status?.replace(/_/g, ' ')}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); navigate(`/people/staff/${r._id}/edit`); }} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Staff</h2>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
            <input placeholder="Search name..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 pr-3 py-2 border rounded-lg text-sm w-48" />
          </div>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <button onClick={() => navigate('/people/staff/new')} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> Add Staff
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        onRowClick={(r: any) => navigate(`/people/staff/${r._id}`)}
        rowKey={(r: any) => r._id}
        rowProps={(r: any) => highlightAttrs(r.person?._id ?? r.personId?._id)}
      />

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
