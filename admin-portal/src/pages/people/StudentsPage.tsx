import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listStudents, deleteStudent } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import StudentThumbnail from '../../components/people/StudentThumbnail';
import { useHighlightRow } from '../../hooks/useHighlightRow';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  prospective: 'default', active: 'success', year_back: 'warning', detained: 'danger',
  graduated: 'teal', exited: 'danger', alumni: 'purple',
};
const STATUSES = ['prospective', 'active', 'year_back', 'detained', 'graduated', 'exited', 'alumni'] as const;
const ONBOARDING_STATUSES = ['not_started', 'in_progress', 'completed'] as const;

export default function StudentsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [filterOnboardingStatus, setFilterOnboardingStatus] = useState(searchParams.get('onboardingStatus') || '');
  const [needsAttention, setNeedsAttention] = useState(searchParams.get('needsAttention') === 'true' || searchParams.get('needsAttention') === '1');
  const [search, setSearch] = useState(searchParams.get('search') || '');

  function syncSearchParams(next: { status?: string; onboardingStatus?: string; search?: string; needsAttention?: boolean }) {
    const params = new URLSearchParams();
    if (next.status) params.set('status', next.status);
    if (next.onboardingStatus) params.set('onboardingStatus', next.onboardingStatus);
    if (next.search) params.set('search', next.search);
    if (next.needsAttention) params.set('needsAttention', 'true');
    setSearchParams(params, { replace: true });
  }

  const { data, isLoading } = useQuery({
    queryKey: ['students', page, filterStatus, search, filterOnboardingStatus, needsAttention],
    queryFn: () => listStudents(page, 20, filterStatus || undefined, search || undefined, filterOnboardingStatus || undefined, needsAttention),
  });

  // Consume ?highlight=<personId> from global-people-search: scrolls to + flashes
  // the matching row once data is loaded.
  const { highlightAttrs } = useHighlightRow({ ready: !isLoading && Boolean(data) });

  const deleteMut = useMutation({
    mutationFn: deleteStudent,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['students'] }); qc.invalidateQueries({ queryKey: ['people-stats'] }); },
  });

  const columns = [
    { key: 'photo', label: '', render: (r: any) => {
      const name = r.person?.name || r.personId?.name || undefined;
      return <StudentThumbnail studentId={r._id} studentName={name} />;
    } },
    { key: 'name', label: 'Name', render: (r: any) => (r.person?.name || r.personId?.name || '—') },
    { key: 'phone', label: 'Phone', render: (r: any) => (r.person?.phone || r.personId?.phone || '—') },
    { key: 'rollNumber', label: 'Roll No', render: (r: any) => r.rollNumber || '—' },
    { key: 'admissionYear', label: 'Year' },
    { key: 'programme', label: 'Programme', render: (r: any) => r.programme?.name || '—' },
    { key: 'branch', label: 'Branch', render: (r: any) => r.branch?.name || '—' },
    { key: 'guardian', label: 'Fee Guardian', render: (r: any) => r.feeResponsibleParentPerson?.name || '—' },
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
    { key: 'onboardingCompleteness', label: 'Onboarding', render: (r: any) => {
      const score = r.onboardingCompleteness;
      if (!score) return '—';
      return (
        <div title={score.missing?.length ? `Pending: ${score.missing.join(', ')}` : 'Onboarding complete'}>
          <Badge variant={score.status === 'completed' ? 'success' : score.status === 'in_progress' ? 'warning' : 'default'}>
            {score.percent}% onboarded
          </Badge>
        </div>
      );
    } },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status]}>{r.status?.replace(/_/g, ' ')}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); navigate(`/people/students/${r._id}/edit`); }} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete student?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Students</h2>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
            <input placeholder="Search name..." value={search} onChange={e => {
              const value = e.target.value;
              setSearch(value);
              setPage(1);
              syncSearchParams({ status: filterStatus, onboardingStatus: filterOnboardingStatus, search: value, needsAttention });
            }}
              className="pl-9 pr-3 py-2 border rounded-lg text-sm w-48" />
          </div>
          <select value={filterStatus} onChange={e => {
            const value = e.target.value;
            setFilterStatus(value);
            setPage(1);
            syncSearchParams({ status: value, onboardingStatus: filterOnboardingStatus, search, needsAttention });
          }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <select value={filterOnboardingStatus} onChange={e => {
            const value = e.target.value;
            setFilterOnboardingStatus(value);
            setPage(1);
            syncSearchParams({ status: filterStatus, onboardingStatus: value, search, needsAttention });
          }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Onboarding</option>
            {ONBOARDING_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <label className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm text-gray-700">
            <input type="checkbox" checked={needsAttention} onChange={e => {
              const checked = e.target.checked;
              setNeedsAttention(checked);
              setPage(1);
              syncSearchParams({ status: filterStatus, onboardingStatus: filterOnboardingStatus, search, needsAttention: checked });
            }} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            Needs action
          </label>
          <button onClick={() => navigate('/people/students/new')} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> Add Student
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        onRowClick={(r: any) => navigate(`/people/students/${r._id}`)}
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
