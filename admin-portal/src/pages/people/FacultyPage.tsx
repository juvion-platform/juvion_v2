import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listFaculty, deleteFaculty } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = { active: 'success', on_leave: 'warning', separated: 'danger' };
const STATUSES = ['active', 'on_leave', 'separated'] as const;

export default function FacultyPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['faculty', page, filterStatus, search],
    queryFn: () => listFaculty(page, 20, filterStatus || undefined, search || undefined),
  });

  const deleteMut = useMutation({
    mutationFn: deleteFaculty,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faculty'] }); qc.invalidateQueries({ queryKey: ['people-stats'] }); },
  });

  const columns = [
    { key: 'employeeCode', label: 'Emp Code' },
    { key: 'name', label: 'Name', render: (r: any) => (r.person?.name || r.personId?.name || '—') },
    { key: 'phone', label: 'Phone', render: (r: any) => (r.person?.phone || r.personId?.phone || '—') },
    { key: 'designation', label: 'Designation' },
    { key: 'department', label: 'Department', render: (r: any) => r.department?.name || '—' },
    { key: 'qualification', label: 'Qualification', render: (r: any) => r.qualification || '—' },
    { key: 'contractType', label: 'Contract', render: (r: any) => <span className="capitalize">{r.contractType}</span> },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status]}>{r.status?.replace(/_/g, ' ')}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); navigate(`/people/faculty/${r._id}/edit`); }} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Faculty</h2>
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
          <button onClick={() => navigate('/people/faculty/new')} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> Add Faculty
          </button>
        </div>
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
