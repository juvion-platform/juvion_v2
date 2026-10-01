import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import Badge from '../ui/Badge';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { retryNoticeDelivery, type NoticeDetail } from '../../services/notices';
import { formatWhen, isNoticeAdmin, noticeErrorMessage, noticeStatus } from '../../lib/notices';

/** Delivery (spec §8, §11): the fan-out state, and "Retry delivery" for admins when the event is dead. */
export default function DeliveryTab({ notice }: { notice: NoticeDetail }) {
  const qc = useQueryClient();
  const admin = isNoticeAdmin(useAuthStore((s) => s.user?.role));
  const d = notice.delivery;
  const status = noticeStatus(notice);

  const retry = useMutation({
    mutationFn: () => retryNoticeDelivery(notice.id),
    meta: { silent: true, silentError: true },
    onSuccess: (delivery) => {
      qc.setQueryData<NoticeDetail>(['notice', notice.id], (old) => (old ? { ...old, delivery } : old));
      qc.invalidateQueries({ queryKey: ['notice', notice.id] });
      qc.invalidateQueries({ queryKey: ['notices'] });
      qc.invalidateQueries({ queryKey: ['notice-dead-events'] });
      toast.success('Delivery retried', 'The notice is being delivered again.');
    },
    onError: (err) => toast.error('Could not retry delivery', noticeErrorMessage(err)),
  });

  return (
    <div className="space-y-4 rounded-xl border bg-white p-5 text-sm">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div><dt className="text-xs text-gray-500">State</dt><dd className="mt-0.5"><Badge variant={status.variant}>{status.label}</Badge></dd></div>
        <div><dt className="text-xs text-gray-500">Attempts</dt><dd className="mt-0.5 tabular-nums">{d.attempts}</dd></div>
        <div><dt className="text-xs text-gray-500">Last update</dt><dd className="mt-0.5">{formatWhen(d.updatedAt)}</dd></div>
        <div>
          <dt className="text-xs text-gray-500">Recipients</dt>
          <dd className="mt-0.5">{d.state === 'delivered' ? `${notice.counts.audience.toLocaleString('en-IN')} (${notice.counts.onJuvi.toLocaleString('en-IN')} on Juvi)` : '—'}</dd>
        </div>
      </dl>
      {d.state === 'delivering' && <p className="text-gray-600">Cards are being written for every member of the audience. This usually takes under a minute; this page refreshes itself.</p>}
      {d.state === 'delivered' && <p className="text-gray-600">Every member on Juvi has the card. Members not on Juvi yet get it when they activate.</p>}
      {d.state === 'failed' && (
        <div className="space-y-3">
          <p className="text-red-700">Delivery stopped after {d.attempts} attempts.{d.lastError ? ` Last error: ${d.lastError}` : ''}</p>
          {admin ? (
            <button type="button" onClick={() => retry.mutate()} disabled={retry.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-white hover:bg-primary-700 disabled:opacity-50">
              <RotateCcw size={14} /> Retry delivery
            </button>
          ) : (
            <p className="text-gray-600">Ask a college admin to retry delivery.</p>
          )}
        </div>
      )}
    </div>
  );
}
