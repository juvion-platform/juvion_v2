import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import SearchInput from '../../components/ui/SearchInput';
import NoticeComposer from '../../components/communication/NoticeComposer';
import DeadEventsPanel from '../../components/communication/DeadEventsPanel';
import { useListControls } from '../../hooks/useListControls';
import { useAuthStore } from '../../stores/authStore';
import { listNotices, getNoticeTargets, type NoticeRow, type NoticeStatus } from '../../services/notices';
import { countsText, deadlineText, formatWhen, isNoticeAdmin, noticeErrorMessage, noticeStatus } from '../../lib/notices';

const sel = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';
const STATUSES: { value: '' | NoticeStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'publishing', label: 'Delivering' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];
/** While a row is still delivering, refetch until its counts land (spec §11 "Delivering…"). */
const DELIVERING_POLL_MS = 3000;

export default function NoticesPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const canCreate = useAuthStore((s) => s.hasPermission('notices', 'create'));
  const admin = isNoticeAdmin(role);
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [status, setStatus] = useState<'' | NoticeStatus>('');
  const [office, setOffice] = useState('');
  const [composing, setComposing] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['notices', { page, limit, search, status, office }],
    queryFn: () => listNotices({ page, limit, q: search, status: status || undefined, office: office || undefined }),
    refetchInterval: (q) => (q.state.data?.items.some((r) => r.delivery.state === 'delivering') ? DELIVERING_POLL_MS : false),
    // Shown inline below; a global toast would repeat on every poll during an outage.
    meta: { silentError: true },
  });
  // Only admins see other offices' notices, so only they get the office filter.
  const { data: targets } = useQuery({ queryKey: ['notice-targets'], queryFn: getNoticeTargets, enabled: admin && canCreate, staleTime: 5 * 60_000 });

  const columns = [
    {
      key: 'title', label: 'Title',
      render: (r: NoticeRow) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-gray-900">{r.title}</span>
          {r.purpose === 'welcome' && <Badge variant="teal">Welcome</Badge>}
        </span>
      ),
    },
    { key: 'office', label: 'Office' },
    { key: 'audienceLine', label: 'Audience', render: (r: NoticeRow) => <span className="text-gray-600">{r.audienceLine}</span> },
    { key: 'publishedAt', label: 'Published', render: (r: NoticeRow) => formatWhen(r.publishedAt) },
    { key: 'counts', label: 'Ack / Seen / Total', sortable: false, render: (r: NoticeRow) => <span className="tabular-nums">{countsText(r)}</span> },
    { key: 'status', label: 'Status', sortable: false, render: (r: NoticeRow) => { const s = noticeStatus(r); return <Badge variant={s.variant}>{s.label}</Badge>; } },
    {
      key: 'deadline', label: 'Deadline',
      render: (r: NoticeRow) => <span className={r.deadlineState === 'passed' ? 'text-amber-700' : 'text-gray-600'}>{deadlineText(r)}</span>,
    },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">Notices</h2>
          <p className="mt-1 text-sm text-gray-500">Official notices sent to the Juvi app, with who has seen and acknowledged each one.</p>
        </div>
        {canCreate && (
          <button type="button" onClick={() => setComposing(true)}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700">
            <Plus size={16} /> New notice
          </button>
        )}
      </div>

      {admin && <DeadEventsPanel />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search notices…" className="w-64" />
        <label className="sr-only" htmlFor="notice-status">Status</label>
        <select id="notice-status" className={sel} value={status} onChange={(e) => { setStatus(e.target.value as '' | NoticeStatus); setPage(1); }}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {admin && targets && (
          <>
            <label className="sr-only" htmlFor="notice-office">Office</label>
            <select id="notice-office" className={sel} value={office} onChange={(e) => { setOffice(e.target.value); setPage(1); }}>
              <option value="">All offices</option>
              {targets.offices.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </>
        )}
      </div>

      {isError && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{noticeErrorMessage(error)}</p>}
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/communication/notices/${r.id}`)}
        rowLabel={(r) => `Open notice ${r.title}`}
        disableSort
        emptyMessage={search || status || office ? 'No notices match these filters.' : 'No notices yet.'}
      />
      {data && (
        <Pagination page={data.page} pages={data.pages} total={data.total} limit={limit} onPageChange={setPage} onLimitChange={setLimit} itemLabel="notices" />
      )}
      <NoticeComposer open={composing} onClose={() => setComposing(false)} />
    </div>
  );
}
