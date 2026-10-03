import { useQuery } from '@tanstack/react-query';
import { getNoticeAudit, type AuditChange, type AuditEntry, type NoticeDetail } from '../../services/notices';
import { PRIORITY_LABELS, formatWhen, noticeErrorMessage } from '../../lib/notices';

const th = 'px-3 py-2 text-left font-medium text-gray-600';
const td = 'px-3 py-2 align-top';
const ACTION_LABELS: Record<string, string> = {
  publish: 'Published', archive: 'Archived', acknowledge: 'Acknowledged', access_denied: 'Reach refused',
};

/** A Mongo ObjectId string — never shown, wherever it turns up. */
const HEX24 = /^[a-f0-9]{24}$/i;
/** `id`, anything ending in `Id` (recipientId, userId, …), and `sessionId` — internal references, never display data. */
const isIdKey = (k: string): boolean => k === 'id' || k === 'sessionId' || /Id$/.test(k);

/** Generic change rendering for actions with no dedicated summary below: flattens an object
 *  value to "key: value" pairs, dropping id-shaped keys and any raw id value outright. */
function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string' && HEX24.test(v)) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object' && !Array.isArray(v)) {
    const entries = Object.entries(v as Record<string, unknown>).filter(([k, x]) => !isIdKey(k) && !(typeof x === 'string' && HEX24.test(x)));
    return entries.length > 0 ? entries.map(([k, x]) => `${k}: ${show(x)}`).join(', ') : '—';
  }
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

/**
 * Human summary for an `acknowledge` entry's `changes[0].newValue`
 * (consumers.ts recordAcknowledgement: `{ recipientId, name, at, late, method,
 * offline, sessionId, hasComment }`). Built only from named, non-identifying
 * fields — `recipientId` and `sessionId` never reach the screen.
 */
function ackSummary(v: Record<string, unknown>): string {
  const name = typeof v.name === 'string' ? v.name : 'Someone';
  const at = typeof v.at === 'string' ? formatWhen(v.at) : '—';
  let s = `${name} acknowledged ${at}`;
  if (v.late) s += ', late';
  s += ` · by ${v.method === 'confirm' ? 'confirm' : 'hold'}`;
  if (v.offline) s += ' · offline';
  if (v.hasComment) s += ' · with a comment';
  return s;
}

/**
 * Human summary for an `access_denied` entry's `changes[0].newValue`
 * (reach-service.ts auditRefusal: `{ action, via, role, userId }`). `userId`
 * never reaches the screen.
 */
function refusalSummary(v: Record<string, unknown>): string {
  const role = typeof v.role === 'string' ? v.role : 'user';
  const via = typeof v.via === 'string' ? v.via : 'erp';
  return `Reach refused for a ${role} (${via})`;
}

function details(e: AuditEntry): string {
  const first = e.changes[0]?.newValue;
  if (e.action === 'acknowledge' && first && typeof first === 'object') return ackSummary(first as Record<string, unknown>);
  if (e.action === 'access_denied' && first && typeof first === 'object') return refusalSummary(first as Record<string, unknown>);
  return e.changes.map(change).join('; ');
}

export type PublishingRecordValues = Pick<NoticeDetail, 'priority' | 'urgentReason' | 'confidential'>;

/**
 * What was decided at publish and cannot change (notifications spec §6.5, §9): the
 * priority, the Urgent reason and the Confidential flag, read from the notice itself.
 */
function PublishingRecord({ record }: { record: PublishingRecordValues }) {
  return (
    <section aria-label="Publishing record" className="rounded-xl border bg-white p-4">
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="text-gray-500">Priority</dt>
        <dd className="text-gray-900">{PRIORITY_LABELS[record.priority]}</dd>
        {record.priority === 'urgent' && (
          <>
            <dt className="text-gray-500">Urgent reason</dt>
            <dd className="whitespace-pre-line text-gray-900">{record.urgentReason ?? 'Not recorded: published before Urgent needed a reason.'}</dd>
          </>
        )}
        <dt className="text-gray-500">Confidential</dt>
        <dd className="text-gray-900">{record.confidential ? 'Yes: the phone notification shows only the office' : 'No'}</dd>
      </dl>
    </section>
  );
}

/**
 * The notice's ERP audit trail (spec §8 Audit; ADM-06): publish, reminders, archive,
 * acknowledgements, refused reach. The detail page passes `record`, which heads the
 * trail with the publishing record.
 */
export default function AuditTab({ noticeId, record }: { noticeId: string; record?: PublishingRecordValues }) {
  return (
    <div className="space-y-4">
      {record && <PublishingRecord record={record} />}
      <AuditTrail noticeId={noticeId} />
    </div>
  );
}

function AuditTrail({ noticeId }: { noticeId: string }) {
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
              <td className={`${td} text-gray-600`}>{details(e)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
