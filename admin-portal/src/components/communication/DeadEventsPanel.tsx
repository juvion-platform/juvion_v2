import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { listDeadEvents } from '../../services/notices';
import { formatWhen } from '../../lib/notices';

const EVENT_LABELS: Record<string, string> = {
  'notice.published': 'Delivery', 'notice.reminder': 'Reminder', 'notice.acknowledged': 'Acknowledgement audit', 'notice.archived': 'Archive',
};

/**
 * Admin-only list of dead notice events (spec §6.2: dead after 8 attempts, listed
 * in the admin console). Renders nothing while there are none. Only a dead
 * delivery can be retried, from that notice's Delivery tab.
 */
export default function DeadEventsPanel() {
  const { data } = useQuery({ queryKey: ['notice-dead-events'], queryFn: () => listDeadEvents(1, 20), meta: { silentError: true } });
  if (!data || data.total === 0) return null;
  return (
    <section aria-label={`Failed deliveries (${data.total})`} className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
      <h3 className="flex items-center gap-2 font-semibold text-red-800">
        <AlertTriangle size={16} aria-hidden="true" /> Failed deliveries ({data.total})
      </h3>
      <p className="mt-1 text-red-700">These background steps stopped after repeated failures.</p>
      {data.total > data.items.length && (
        <p className="mt-1 text-xs text-red-700">Showing {data.items.length} of {data.total}.</p>
      )}
      <ul className="mt-2 divide-y divide-red-100">
        {data.items.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
            <span>
              <span className="font-medium text-red-900">{EVENT_LABELS[e.type] ?? e.type}</span>
              <span className="text-red-700"> · {e.attempts} attempts · {formatWhen(e.updatedAt ?? e.createdAt)}{e.lastError ? ` · ${e.lastError}` : ''}</span>
            </span>
            {e.noticeId && e.type === 'notice.published' && (
              <Link to={`/communication/notices/${e.noticeId}/delivery`} className="font-medium text-red-800 underline">Open delivery</Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
