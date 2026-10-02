import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import clsx from 'clsx';
import type { NoticePriority } from '../../services/notices';
import { PRIORITY_LABELS, formatInZone } from '../../lib/notices';

/** Time left to the deadline as a ring that empties, red once it has passed (the app's DeadlineRing). */
export function DeadlineRing({ deadline, start, now = Date.now(), size = 36 }: { deadline: string; start: number; now?: number; size?: number }) {
  const end = new Date(deadline).getTime();
  const left = Math.min(Math.max((end - now) / Math.max(end - start, 1), 0), 1);
  const passed = end <= now;
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
      aria-label={passed ? 'Deadline passed' : `${Math.round(left * 100)}% of the time to the deadline left`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={passed ? '#DC2626' : '#0D9488'} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - left)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

interface Props {
  title: string; body: string; office: string; audienceLine: string; priority: NoticePriority;
  ackRequired: boolean; deadline: string | null; timezone: string; attachmentCount: number;
}

/** The notice as its Juvi card will first look (spec §8 "a Juvi card preview"). */
export default function NoticeCardPreview({ title, body, office, audienceLine, priority, ackRequired, deadline, timezone, attachmentCount }: Props) {
  // The card is first seen at publish time, so the ring starts full.
  const [start] = useState(() => Date.now());
  return (
    <section aria-label="Preview in the Juvi app" className="w-full rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-gray-700">{office}</span>
        {priority !== 'routine' && (
          <span className={clsx('rounded-full px-2 py-0.5 font-medium', priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800')}>
            {PRIORITY_LABELS[priority]}
          </span>
        )}
      </div>
      <h4 className="mt-2 text-base font-semibold text-gray-900">{title.trim() || 'Notice title'}</h4>
      <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-gray-700">{body.trim() || 'The notice text appears here.'}</p>
      {attachmentCount > 0 && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500">
          <Paperclip size={12} aria-hidden="true" /> {attachmentCount} {attachmentCount === 1 ? 'attachment' : 'attachments'}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
        <span className="text-xs text-gray-500">{audienceLine || 'Choose an audience'}</span>
        {ackRequired && (
          <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-gray-700">
            {deadline && <DeadlineRing deadline={deadline} start={start} />}
            {deadline ? `Acknowledge by ${formatInZone(deadline, timezone)}` : 'Acknowledgement required'}
          </span>
        )}
      </div>
    </section>
  );
}
