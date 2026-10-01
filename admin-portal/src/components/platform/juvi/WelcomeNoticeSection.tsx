import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save } from 'lucide-react';
import NoticeComposer, { type ComposerInitial } from '../../communication/NoticeComposer';
import { getJuviSettings, updateJuviSettings, type AdminSettingsView } from '../../../services/juvi-app';
import { listNotices } from '../../../services/notices';
import { useAuthStore } from '../../../stores/authStore';
import { toast } from '../../../stores/toastStore';
import { formatWhen, noticeErrorMessage, roleLabel } from '../../../lib/notices';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

type Slot = 'studentNoticeId' | 'facultyNoticeId';
/** Students use the student slot; faculty and staff share the faculty slot (backend welcome-service.ts welcomeSlot). */
const SLOTS: { slot: Slot; label: string; composer: string; roles: string[] }[] = [
  { slot: 'studentNoticeId', label: 'Students', composer: 'Welcome notice for students', roles: ['student'] },
  { slot: 'facultyNoticeId', label: 'Faculty and staff', composer: 'Welcome notice for faculty and staff', roles: ['faculty', 'staff'] },
];
const WELCOME_QUERY = { page: 1, limit: 100, purpose: 'welcome', status: 'published' } as const;

const fromView = (view: AdminSettingsView): Record<Slot, string> => ({
  studentNoticeId: view.juvi.welcomeNotice?.studentNoticeId ?? '',
  facultyNoticeId: view.juvi.welcomeNotice?.facultyNoticeId ?? '',
});

/**
 * Settings › Welcome notice (spec §8, US-5): pick a published `purpose: welcome`
 * notice per kind, or keep the auto-created default; or create one in the
 * composer, prefilled. Saved through PUT /settings `welcomeNotice`.
 */
export default function WelcomeNoticeSection({ canUpdate }: { canUpdate: boolean }) {
  const qc = useQueryClient();
  const canCompose = useAuthStore((s) => s.hasPermission('notices', 'create'));
  const settingsQ = useQuery({ queryKey: ['juvi-admin-settings'], queryFn: getJuviSettings });
  const welcomeQ = useQuery({ queryKey: ['notices', WELCOME_QUERY], queryFn: () => listNotices({ ...WELCOME_QUERY }), meta: { silentError: true } });
  const [base, setBase] = useState<Record<Slot, string> | null>(null);
  const [choice, setChoice] = useState<Record<Slot, string> | null>(null);
  const [composing, setComposing] = useState<(typeof SLOTS)[number] | null>(null);

  // Seed once, like SettingsTab: a background refetch never clobbers a pending choice.
  useEffect(() => {
    if (settingsQ.data && choice === null) { const c = fromView(settingsQ.data); setBase(c); setChoice(c); }
  }, [settingsQ.data, choice]);

  const save = useMutation({
    mutationFn: (patch: Partial<Record<Slot, string | null>>) => updateJuviSettings({ welcomeNotice: patch }),
    meta: { silent: true, silentError: true },
    onSuccess: (view) => {
      qc.setQueryData(['juvi-admin-settings'], view);
      const c = fromView(view);
      setBase(c);
      setChoice(c);
      toast.success('Welcome notices saved');
    },
    onError: (err) => toast.error('Could not save the welcome notices', noticeErrorMessage(err)),
  });

  if (!choice || !base) return null;
  const items = welcomeQ.data?.items ?? [];

  function onSave() {
    const patch: Partial<Record<Slot, string | null>> = {};
    for (const { slot } of SLOTS) if (choice![slot] !== base![slot]) patch[slot] = choice![slot] || null;
    if (Object.keys(patch).length === 0) { toast.success('Nothing to save'); return; }
    save.mutate(patch);
  }

  const initialFor = (s: (typeof SLOTS)[number]): ComposerInitial => ({
    purpose: 'welcome', title: 'Welcome to Juvi', ackRequired: true,
    audience: { role: s.roles.map((id) => ({ id, label: roleLabel(id) })) },
  });

  return (
    <section aria-labelledby="welcome-notice-heading" className="space-y-4 rounded-xl border bg-white p-5">
      <div>
        <h3 id="welcome-notice-heading" className="text-sm font-semibold text-navy">Welcome notice</h3>
        <p className="mt-1 text-xs text-gray-500">
          The first notice in onboarding (step 4), acknowledged for real. Default uses the welcome notice Juvi creates automatically.
        </p>
      </div>
      {welcomeQ.isError && <p role="alert" className="text-sm text-red-700">{noticeErrorMessage(welcomeQ.error)}</p>}
      {SLOTS.map((s) => {
        const value = choice[s.slot];
        const missing = value && !items.some((n) => n.id === value);
        return (
          <div key={s.slot}>
            <label htmlFor={`welcome-${s.slot}`} className={lbl}>{s.label}</label>
            <div className="flex flex-wrap gap-2">
              <select id={`welcome-${s.slot}`} className={`${inp} sm:max-w-md`} value={value} disabled={!canUpdate || save.isPending}
                onChange={(e) => setChoice({ ...choice, [s.slot]: e.target.value })}>
                <option value="">Default welcome notice</option>
                {missing && <option value={value}>The current notice (no longer published)</option>}
                {items.map((n) => <option key={n.id} value={n.id}>{n.title} · {n.office} · {formatWhen(n.publishedAt)}</option>)}
              </select>
              {canCompose && (
                <button type="button" onClick={() => setComposing(s)} aria-label={`Create welcome notice for ${s.label.toLowerCase()}`}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                  <Plus size={14} /> Create welcome notice
                </button>
              )}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-gray-500">A new welcome notice appears in these lists once its delivery has finished.</p>
      <div className="flex justify-end">
        <button type="button" onClick={onSave} disabled={!canUpdate || save.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50">
          <Save size={16} /> Save welcome notices
        </button>
      </div>
      <NoticeComposer open={composing !== null} onClose={() => setComposing(null)} title={composing?.composer ?? 'Welcome notice'}
        initial={composing ? initialFor(composing) : undefined} />
    </section>
  );
}
