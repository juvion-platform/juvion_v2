import { Bell, BellOff, BellRing } from 'lucide-react';
import type { NoticePriority } from '../../services/notices';
import { TRAY_ALERT, trayNotification } from '../../lib/notices';

interface Props { office: string; title: string; priority: NoticePriority; confidential: boolean; welcome: boolean }

const ALERT_ICON = { urgent: BellRing, important: Bell, routine: BellOff } as const;
const ALERT_WORD: Record<NoticePriority, string> = { urgent: 'Rings', important: 'Sound', routine: 'Silent' };

function TrayRow({ label, title, text, priority }: { label: string; title: string; text: string | null; priority: NoticePriority }) {
  const Icon = ALERT_ICON[priority];
  return (
    <div>
      <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <div className="rounded-xl bg-white/10 px-3 py-2">
        <div className="flex items-center justify-between gap-2 text-[11px] text-gray-300">
          <span>Juvi · now</span>
          <span className="inline-flex items-center gap-1"><Icon size={12} aria-hidden="true" /> {ALERT_WORD[priority]}</span>
        </div>
        <p className="mt-0.5 text-sm font-semibold">{title}</p>
        {text && <p className="text-sm text-gray-200">{text}</p>}
      </div>
    </div>
  );
}

/**
 * The phone notification as the tray shows it (notifications spec §6.6, §9): the
 * office and the title, only the office for a confidential notice, and how the tier
 * alerts. A reminder is always Important (spec §4.1). Welcome notices are never pushed.
 */
export default function NotificationTrayPreview({ office, title, priority, confidential, welcome }: Props) {
  if (welcome) {
    return (
      <section aria-label="Phone notification preview" className="rounded-2xl border border-dashed p-3 text-xs text-gray-500">
        A welcome notice sends no phone notification. New accounts see it at onboarding.
      </section>
    );
  }
  const published = trayNotification({ office, title, confidential, variant: 'published' });
  const reminder = trayNotification({ office, title, confidential, variant: 'reminder' });
  return (
    <section aria-label="Phone notification preview" className="space-y-3 rounded-2xl bg-gray-900 p-3 text-white">
      <TrayRow label="When published" title={published.title} text={published.text} priority={priority} />
      <p className="text-xs text-gray-300">{TRAY_ALERT[priority]}</p>
      <TrayRow label="If you send a reminder" title={reminder.title} text={reminder.text} priority="important" />
    </section>
  );
}
