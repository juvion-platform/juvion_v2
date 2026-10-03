import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Route, Routes, useParams } from 'react-router-dom';
import { ArrowLeft, Paperclip } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import ReachTab from '../../components/communication/ReachTab';
import AuditTab from '../../components/communication/AuditTab';
import DeliveryTab from '../../components/communication/DeliveryTab';
import { getNotice } from '../../services/notices';
import { PRIORITY_LABELS, deadlineText, errorStatus, formatBytes, formatWhen, noticeErrorMessage, noticeStatus } from '../../lib/notices';

/** Polled while the fan-out runs, so "Delivering…" settles on its own. */
const DELIVERING_POLL_MS = 3000;

export default function NoticeDetailPage() {
  const { id = '' } = useParams();
  const { data: notice, isLoading, isError, error } = useQuery({
    queryKey: ['notice', id],
    queryFn: () => getNotice(id),
    refetchInterval: (q) => (q.state.data?.delivery.state === 'delivering' ? DELIVERING_POLL_MS : false),
    meta: { silentError: true },
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading notice…</p>;
  // The full error screen only when there is nothing to show; a failed background refetch keeps the page.
  if (!notice) {
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p className="text-red-700">
          {errorStatus(error) === 404 ? 'This notice does not exist, or it is not one you can see.' : noticeErrorMessage(error)}
        </p>
        <Link to="/communication/notices" className="text-primary-700 underline">Back to notices</Link>
      </div>
    );
  }

  const status = noticeStatus(notice);
  const base = `/communication/notices/${notice.id}`;
  // Absolute targets, as in JuviAdminPage: this page is mounted at "notices/:id/*".
  const tabs = [
    { to: base, label: 'Reach', end: true },
    { to: `${base}/audit`, label: 'Audit', end: false },
    { to: `${base}/delivery`, label: 'Delivery', end: false },
  ];

  return (
    <div>
      <Link to="/communication/notices" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft size={14} /> Notices
      </Link>
      {isError && (
        <p role="alert" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Could not refresh this notice: {noticeErrorMessage(error)} Showing what was last loaded.
        </p>
      )}
      <div className="mb-4 rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-navy">{notice.title}</h2>
          <Badge variant={status.variant}>{status.label}</Badge>
          {notice.priority !== 'routine' && <Badge variant={notice.priority === 'urgent' ? 'danger' : 'warning'}>{PRIORITY_LABELS[notice.priority]}</Badge>}
          {notice.confidential && <Badge>Confidential</Badge>}
          {notice.purpose === 'welcome' && <Badge variant="teal">Welcome</Badge>}
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {notice.office} · {notice.audience.line} · Published {formatWhen(notice.publishedAt)} · {deadlineText(notice)}
        </p>
        <p className="mt-3 whitespace-pre-line text-sm text-gray-800">{notice.body}</p>
        {notice.attachments.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Attachments">
            {notice.attachments.map((a) => (
              <li key={a.key} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">
                <Paperclip size={12} aria-hidden="true" /> {a.name} <span className="text-gray-500">{formatBytes(a.size)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <nav className="mb-5 flex gap-1 border-b" aria-label="Notice sections">
        {tabs.map((t) => (
          <NavLink key={t.label} to={t.to} end={t.end}
            className={({ isActive }) => `-mb-px border-b-2 px-4 py-2 text-sm ${isActive ? 'border-primary-600 font-medium text-primary-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<ReachTab notice={notice} />} />
        <Route path="audit" element={<AuditTab noticeId={notice.id} record={notice} />} />
        <Route path="delivery" element={<DeliveryTab notice={notice} />} />
      </Routes>
    </div>
  );
}
