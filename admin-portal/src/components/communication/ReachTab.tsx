import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, BellRing, ClipboardCopy, Download } from 'lucide-react';
import Badge from '../ui/Badge';
import SearchInput from '../ui/SearchInput';
import { useAuthStore } from '../../stores/authStore';
import { confirmAction } from '../../stores/confirmStore';
import { toast } from '../../stores/toastStore';
import { saveBlob } from '../../services/juvi-app';
import {
  archiveNotice, downloadReachCsv, getAllPending, getPending, getReach, remindNotice,
  type DeliveryCounts, type NoticeDetail, type Reach, type ReachState, type Reminders,
} from '../../services/notices';
import {
  PENDING_DELIVERY_LABELS, PENDING_STATE_LABELS, deliveryTotal, errorDetail, errorStatus, formatWhen, isNoticeAdmin, noticeErrorMessage, pendingAsText,
} from '../../lib/notices';

const sel = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';
const btn = 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const th = 'px-3 py-2 text-left font-medium text-gray-600';
const td = 'px-3 py-2';
const REACH_STATE_LABELS: Record<ReachState, string> = { acknowledged: 'Acknowledged', seen: 'Seen', not_seen: 'Not seen', not_on_juvi: 'Not on Juvi' };
const PENDING_PAGE = 50;
const n = (x: number) => x.toLocaleString('en-IN');

/**
 * The published notification's push delivery (notifications spec §7.4, §9): each
 * person once, at their notification's current step.
 */
function DeliveryRow({ d }: { d: DeliveryCounts }) {
  const items: [string, number][] = [
    ['Scheduled', d.scheduled], ['Sent', d.sent], ['Delivered', d.delivered], ['Opened', d.opened], ['Failed', d.failed], ['Cancelled', d.cancelled],
    ['Muted', d.suppressed.muted], ['Notifications off', d.suppressed.tierOff], ['No device', d.suppressed.noDevice],
  ];
  return (
    <div role="group" aria-label="Notification delivery" className="mt-4 border-t pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Notification delivery</p>
      {deliveryTotal(d) === 0 ? (
        <p className="mt-1 text-sm text-gray-500">No phone notifications recorded yet for this notice.</p>
      ) : (
        <>
          <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {items.map(([label, value]) => (
              <div key={label} className="flex gap-1.5">
                <dt className="text-gray-500">{label}</dt>
                <dd className="font-medium tabular-nums text-gray-900">{n(value)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-1 text-xs text-gray-500">
            Each person is counted once, at their latest step. Sent means the phone has not confirmed it yet; Muted, Notifications off and No device were not sent.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Reach, the ERP side of S11 (spec §8, US-4): counts that reconcile to the
 * audience snapshot, the per-group breakdown, the pending list, late
 * acknowledgements, comments, added-later members, CSV (admins), copy
 * pending, remind (at most 2) and archive.
 */
export default function ReachTab({ notice }: { notice: NoticeDetail }) {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const admin = isNoticeAdmin(role);
  // canManage is the row-level answer; notices:update is the policy one (spec §7.2). Both must hold.
  const manage = useAuthStore((s) => s.hasPermission('notices', 'update')) && notice.canManage;
  const id = notice.id;
  const delivered = notice.status !== 'publishing';
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');

  const reachQ = useQuery({ queryKey: ['notice-reach', id], queryFn: () => getReach(id), enabled: delivered, meta: { silentError: true } });
  const pendingQ = useInfiniteQuery({
    queryKey: ['notice-pending', id, { q, group }],
    queryFn: ({ pageParam }) => getPending(id, { q: q || undefined, group: group || undefined, cursor: pageParam, limit: PENDING_PAGE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: delivered,
    meta: { silentError: true },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['notice', id] });
    qc.invalidateQueries({ queryKey: ['notices'] });
    qc.invalidateQueries({ queryKey: ['notice-audit', id] });
  };
  const setReminders = (reminders: Reminders) =>
    qc.setQueryData<Reach>(['notice-reach', id], (old) => (old ? { ...old, reminders } : old));

  const remind = useMutation({
    mutationFn: () => remindNotice(id),
    meta: { silent: true, silentError: true },
    onSuccess: ({ reminders }) => {
      setReminders(reminders);
      refresh();
      toast.success('Reminder sent', `${reminders.used} of ${reminders.max} reminders used.`);
    },
    onError: (err) => {
      // A REMINDER_LIMIT 409 carries the current count; show it rather than a stale one.
      const reminders = errorDetail<{ reminders: Reminders }>(err)?.reminders;
      if (reminders) setReminders(reminders);
      toast.error('Could not send the reminder', noticeErrorMessage(err));
    },
  });
  const archive = useMutation({
    mutationFn: () => archiveNotice(id),
    meta: { silent: true, silentError: true },
    onSuccess: () => {
      refresh();
      qc.invalidateQueries({ queryKey: ['notice-reach', id] });
      toast.success('Notice archived', 'It is read-only in the app now. Its reach is kept.');
    },
    onError: (err) => toast.error('Could not archive the notice', noticeErrorMessage(err)),
  });
  const csv = useMutation({
    mutationFn: () => downloadReachCsv(id),
    meta: { silent: true, silentError: true },
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
    onError: (err) => toast.error('Could not export the reach', noticeErrorMessage(err)),
  });
  const copy = useMutation({
    mutationFn: async () => {
      const people = await getAllPending(id);
      await navigator.clipboard.writeText(pendingAsText(notice.title, people));
      return people.length;
    },
    meta: { silent: true, silentError: true },
    onSuccess: (count) => toast.success('Pending list copied', `${n(count)} ${count === 1 ? 'person' : 'people'}.`),
    onError: (err) => toast.error('Could not copy the pending list', noticeErrorMessage(err)),
  });

  async function onRemind(r: Reminders) {
    const left = r.max - r.used - 1;
    const { confirmed } = await confirmAction({
      title: 'Send a reminder?',
      message: `Everyone who has not ${notice.ackRequired ? 'acknowledged' : 'seen'} it yet is reminded on their next refresh. ${left === 0 ? 'This is the last reminder you can send.' : `${left} more can be sent after this.`}`,
      confirmLabel: 'Send reminder',
    });
    if (confirmed) remind.mutate();
  }
  async function onArchive() {
    const { confirmed } = await confirmAction({
      title: 'Archive this notice?',
      message: 'It becomes read-only in the app and leaves everyone\'s Due list. Its reach is kept. This cannot be undone.',
      confirmLabel: 'Archive', tone: 'danger',
    });
    if (confirmed) archive.mutate();
  }

  if (!delivered) return <p className="text-sm text-gray-500">Reach appears once delivery has finished. See the Delivery tab.</p>;
  if (reachQ.isError) {
    return <p role="alert" className="text-sm text-red-700">{errorStatus(reachQ.error) === 403 ? 'Only the publisher and admins can see reach. ' : ''}{noticeErrorMessage(reachQ.error)}</p>;
  }
  const r = reachQ.data;
  if (!r) return <p className="text-sm text-gray-500">Loading reach…</p>;

  const sum = r.acknowledged + r.seen + r.notSeen + r.notOnJuvi;
  const pendingRows = pendingQ.data?.pages.flatMap((p) => p.items) ?? [];
  const firstPage = pendingQ.data?.pages[0];
  const remindBlocked = r.reminders.used >= r.reminders.max || r.status !== 'published';
  const cards = [
    { label: 'Acknowledged', value: r.acknowledged, hidden: !r.ackRequired },
    { label: r.ackRequired ? 'Seen, not acknowledged' : 'Seen', value: r.seen },
    { label: 'Not seen', value: r.notSeen },
    { label: 'Not on Juvi', value: r.notOnJuvi },
  ].filter((c) => !c.hidden);

  return (
    <div className="space-y-6">
      <section aria-label="Reach summary" className="rounded-xl border bg-white p-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label}>
              <dt className="text-xs text-gray-500">{c.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums text-gray-900">{n(c.value)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-gray-600">
          {n(r.acknowledged)} acknowledged + {n(r.seen)} seen + {n(r.notSeen)} not seen + {n(r.notOnJuvi)} not on Juvi = {n(r.audience)} in the audience snapshot
        </p>
        {sum !== r.audience && <p role="alert" className="mt-1 text-sm text-red-700">These counts do not add up to the snapshot. Refresh the page; if it persists, report it.</p>}
        <p className="mt-1 text-xs text-gray-500">
          {r.ackRequired ? `${n(r.late)} acknowledged late` : `${n(r.dismissed)} dismissed`} · as of {formatWhen(r.asOf)}
        </p>
        <DeliveryRow d={r.delivery} />

        <div className="mt-4 flex flex-wrap gap-2">
          {manage && (
            <button type="button" className={btn} onClick={() => onRemind(r.reminders)} disabled={remindBlocked || remind.isPending}
              title={r.reminders.used >= r.reminders.max ? 'A notice can have at most two reminders.' : r.status !== 'published' ? 'Only a published notice can be reminded.' : undefined}>
              <BellRing size={14} /> Remind ({r.reminders.used} of {r.reminders.max} used)
            </button>
          )}
          <button type="button" className={btn} onClick={() => copy.mutate()} disabled={copy.isPending}>
            <ClipboardCopy size={14} /> Copy pending list
          </button>
          {admin && (
            <button type="button" className={btn} onClick={() => csv.mutate()} disabled={csv.isPending}>
              <Download size={14} /> Export CSV
            </button>
          )}
          {manage && notice.status !== 'archived' && (
            <button type="button" className={`${btn} text-red-700`} onClick={onArchive} disabled={archive.isPending}>
              <Archive size={14} /> Archive
            </button>
          )}
        </div>
        {r.reminders.lastAt && <p className="mt-2 text-xs text-gray-500">Last reminder {formatWhen(r.reminders.lastAt)}</p>}
      </section>

      {r.groups.length > 0 && (
        <section aria-labelledby="reach-groups" className="overflow-x-auto rounded-xl border bg-white">
          <h3 id="reach-groups" className="px-5 pt-4 text-sm font-semibold text-navy">By batch, section or department</h3>
          <table className="mt-2 w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr><th className={th}>Group</th><th className={th}>Total</th>{r.ackRequired && <th className={th}>Acknowledged</th>}<th className={th}>Seen</th><th className={th}>Not seen</th><th className={th}>Not on Juvi</th></tr>
            </thead>
            <tbody className="divide-y">
              {r.groups.map((g) => (
                <tr key={g.label}>
                  <td className={td}>{g.label}</td><td className={`${td} tabular-nums`}>{g.total}</td>
                  {r.ackRequired && <td className={`${td} tabular-nums`}>{g.acknowledged}</td>}
                  <td className={`${td} tabular-nums`}>{g.seen}</td><td className={`${td} tabular-nums`}>{g.notSeen}</td><td className={`${td} tabular-nums`}>{g.notOnJuvi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section aria-labelledby="reach-pending" className="rounded-xl border bg-white p-5">
        <h3 id="reach-pending" className="text-sm font-semibold text-navy">Pending{firstPage ? ` (${n(firstPage.total)})` : ''}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <SearchInput value={q} onChange={setQ} placeholder="Search by name or roll number…" className="w-72" aria-label="Search pending" />
          <label className="sr-only" htmlFor="pending-group">Group</label>
          <select id="pending-group" className={sel} value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">All groups</option>
            {(firstPage?.groups ?? []).map((g) => <option key={g.label} value={g.label}>{g.label} ({g.count})</option>)}
          </select>
        </div>
        {pendingQ.isError && <p role="alert" className="mt-3 text-sm text-red-700">{noticeErrorMessage(pendingQ.error)}</p>}
        {pendingRows.length === 0 && !pendingQ.isLoading ? (
          <p className="mt-3 text-sm text-gray-500">{q || group ? 'Nobody pending matches.' : 'Nobody is pending.'}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm" aria-label="Pending members">
              <thead className="border-b bg-gray-50">
                <tr><th className={th}>Name</th><th className={th}>Roll / employee no.</th><th className={th}>Group</th><th className={th}>State</th><th className={th}>Last in the app</th><th className={th}>Delivery</th></tr>
              </thead>
              <tbody className="divide-y">
                {pendingRows.map((p, i) => (
                  <tr key={`${p.group}:${p.name}:${i}`}>
                    <td className={td}>{p.name}</td><td className={td}>{p.identifier ?? '—'}</td><td className={td}>{p.group}</td>
                    <td className={td}>{PENDING_STATE_LABELS[p.state]}</td><td className={td}>{p.state === 'not_on_juvi' ? '—' : formatWhen(p.lastSeenInApp)}</td>
                    <td className={td}>{PENDING_DELIVERY_LABELS[p.delivery]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
          <span aria-live="polite">{firstPage ? `Showing ${n(pendingRows.length)} of ${n(firstPage.total)}` : ''}</span>
          {pendingQ.hasNextPage && (
            <button type="button" className={btn} onClick={() => pendingQ.fetchNextPage()} disabled={pendingQ.isFetchingNextPage}>Load more</button>
          )}
        </div>
      </section>

      {r.ackRequired && (
        <section aria-labelledby="reach-late" className="rounded-xl border bg-white p-5">
          <h3 id="reach-late" className="text-sm font-semibold text-navy">Late acknowledgements ({n(r.late)})</h3>
          {r.lateAcks.length === 0 ? <p className="mt-2 text-sm text-gray-500">None.</p> : (
            <table className="mt-2 w-full text-sm" aria-label="Late acknowledgements">
              <thead className="border-b bg-gray-50"><tr><th className={th}>Name</th><th className={th}>Roll / employee no.</th><th className={th}>Group</th><th className={th}>Acknowledged</th></tr></thead>
              <tbody className="divide-y">
                {r.lateAcks.map((p, i) => (
                  <tr key={`${p.name}:${i}`}><td className={td}>{p.name}</td><td className={td}>{p.identifier ?? '—'}</td><td className={td}>{p.group}</td><td className={td}>{formatWhen(p.at)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {notice.ackCommentAllowed && (
        <section aria-labelledby="reach-comments" className="rounded-xl border bg-white p-5">
          <h3 id="reach-comments" className="text-sm font-semibold text-navy">Comments ({n(r.comments.length)})</h3>
          {r.comments.length === 0 ? <p className="mt-2 text-sm text-gray-500">No comments yet.</p> : (
            <ul className="mt-2 divide-y">
              {r.comments.map((c, i) => (
                <li key={`${c.name}:${i}`} className="py-2 text-sm">
                  <p className="text-gray-900"><span className="font-medium">{c.name}</span> <span className="text-gray-500">· {c.group} · {formatWhen(c.at)}</span> {c.late && <Badge variant="warning">Late</Badge>}</p>
                  <p className="mt-0.5 whitespace-pre-line text-gray-700">{c.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="reach-later" className="rounded-xl border bg-white p-5">
        <h3 id="reach-later" className="text-sm font-semibold text-navy">Added later ({n(r.addedLater.total)})</h3>
        <p className="mt-1 text-xs text-gray-500">
          People who matched the audience after it was published: {n(r.addedLater.acknowledged)} acknowledged, {n(r.addedLater.seen)} seen. They are not counted as pending.
        </p>
        {r.addedLater.items.length > 0 && (
          <table className="mt-2 w-full text-sm" aria-label="Added later">
            <thead className="border-b bg-gray-50"><tr><th className={th}>Name</th><th className={th}>Roll / employee no.</th><th className={th}>Group</th><th className={th}>State</th><th className={th}>When</th></tr></thead>
            <tbody className="divide-y">
              {r.addedLater.items.map((p, i) => (
                <tr key={`${p.name}:${i}`}><td className={td}>{p.name}</td><td className={td}>{p.identifier ?? '—'}</td><td className={td}>{p.group}</td><td className={td}>{REACH_STATE_LABELS[p.state]}</td><td className={td}>{formatWhen(p.at)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
