import { useQuery } from '@tanstack/react-query';
import { getNoticeAudit, type AuditChange, type AuditEntry } from '../../services/notices';
import { formatWhen, noticeErrorMessage } from '../../lib/notices';

const th = 'px-3 py-2 text-left font-medium text-gray-600';
const td = 'px-3 py-2 align-top';
const ACTION_LABELS: Record<string, string> = {
  publish: 'Published', archive: 'Archived', acknowledge: 'Acknowledged', access_denied: 'Reach refused',
};

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${show(x)}`).join(', ');
  return String(v);
}
const change = (c: AuditChange) => `${c.displayName ?? c.field}: ${show(c.oldValue)} → ${show(c.newValue)}`;

/**
 * `update` covers more than one server action (remindNotice and retryDelivery
 * both write `action: 'update'`; publish-service.ts and admin-service.ts), and
 * the audit log carries no machine-readable code for which. The label is
 * derived from what the entry's own changes record, falling back to "Updated"
 * only when they don't say (R1).
 */
function actionLabel(e: AuditEntry): string {
  if (e.action !== 'update') return ACTION_LABELS[e.action] ?? e.action;
  if (e.changes.some((c) => c.field === 'reminders')) return 'Reminder sent';
  if (e.changes.some((c) => c.field === 'delivery')) return 'Delivery retried';
  return 'Updated';
}

/** The notice's ERP audit trail (spec §8 Audit; ADM-06): publish, reminders, archive, acknowledgements, refused reach. */
export default function AuditTab({ noticeId }: { noticeId: string }) {
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['notice-audit', noticeId], queryFn: () => getNoticeAudit(noticeId), meta: { silentError: true } });
  if (isError) return <p role="alert" className="text-sm text-red-700">{noticeErrorMessage(error)}</p>;
  if (isLoading || !data) return <p className="text-sm text-gray-500">Loading the audit trail…</p>;
  if (data.items.length === 0) return <p className="text-sm text-gray-500">Nothing recorded yet.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-sm" aria-label="Audit trail">
        <thead className="border-b bg-gray-50">
          <tr><th className={th}>When</th><th className={th}>Action</th><th className={th}>By</th><th className={th}>Details</th></tr>
        </thead>
        <tbody className="divide-y">
          {data.items.map((e, i) => (
            <tr key={`${e.at}:${i}`}>
              <td className={`${td} whitespace-nowrap`}>{formatWhen(e.at)}</td>
              <td className={td}>{actionLabel(e)}</td>
              <td className={td}>{e.performedBy}</td>
              <td className={`${td} text-gray-600`}>{e.changes.map(change).join('; ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
