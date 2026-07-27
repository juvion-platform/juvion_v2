import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listFaculty, deleteFaculty } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import PersonThumbnail from '../../components/people/PersonThumbnail';
import { useHighlightRow } from '../../hooks/useHighlightRow';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const STATUS_COLOR: Record<string, string> = { active: 'success', on_leave: 'warning', separated: 'danger' };
const STATUSES = ['active', 'on_leave', 'separated'] as const;

export default function FacultyPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { page, setPage, limit, setLimit } = useListControls();
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['faculty', page, filterStatus, search, limit],
    queryFn: () => listFaculty(page, limit, filterStatus || undefined, search || undefined),
  });

  // Consume ?highlight=<personId> from global-people-search: scrolls to + flashes
  // the matching row once data is loaded.
  const { highlightAttrs } = useHighlightRow({ ready: !isLoading && Boolean(data) });

  const deleteMut = useMutation({
    mutationFn: deleteFaculty,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faculty'] }); qc.invalidateQueries({ queryKey: ['people-stats'] }); },
  });

  const columns = [
    { key: 'photo', label: '', render: (r: any) => {
      const name = r.person?.name || r.personId?.name || undefined;
      return <PersonThumbnail entityType="faculty" entityId={r._id} personName={name} />;
    } },
    { key: 'employeeCode', label: 'Emp Code' },
    { key: 'name', label: 'Name', render: (r: any) => (r.person?.name || r.personId?.name || '—') },
    { key: 'phone', label: 'Phone', render: (r: any) => (r.person?.phone || r.personId?.phone || '—') },
    { key: 'designation', label: 'Designation' },
    { key: 'department', label: 'Department', render: (r: any) => r.department?.name || '—' },
    { key: 'qualification', label: 'Qualification', render: (r: any) => r.qualification || '—' },
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
    { key: 'contractType', label: 'Contract', render: (r: any) => <span className="capitalize">{r.contractType}</span> },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status]}>{r.status?.replace(/_/g, ' ')}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); navigate(`/people/faculty/${r._id}/edit`); }} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Faculty</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search faculty…" className="w-56" />
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <button onClick={() => navigate('/people/faculty/new')} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> Add Faculty
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        onRowClick={(r: any) => navigate(`/people/faculty/${r._id}`)}
        rowKey={(r: any) => r._id}
        rowProps={(r: any) => highlightAttrs(r.person?._id ?? r.personId?._id)}
        emptyMessage={search ? `No faculty match “${search}”.` : 'No faculty yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
    </div>
  );
}
