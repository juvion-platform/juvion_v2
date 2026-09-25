import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Save } from 'lucide-react';
import { getJuviSettings, updateJuviSettings, reconcileNow, type JuviSettings, type JuviSettingsPatch } from '../../../services/juvi-app';
import { useAuthStore } from '../../../stores/authStore';
import { toast } from '../../../stores/toastStore';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';
const HEX = /^#[0-9a-fA-F]{6}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

interface Form {
  enabled: boolean; paused: boolean; pausedMessage: string; accentColor: string;
  contactName: string; contactPhone: string; contactEmail: string;
  quietStart: string; quietEnd: string; minAndroid: string; minIos: string; timezone: string;
}

const toForm = (j: JuviSettings): Form => ({
  enabled: j.enabled, paused: j.paused, pausedMessage: j.pausedMessage ?? '', accentColor: j.accentColor ?? '',
  contactName: j.supportContact?.name ?? '', contactPhone: j.supportContact?.phone ?? '', contactEmail: j.supportContact?.email ?? '',
  quietStart: j.quietHoursDefault.start, quietEnd: j.quietHoursDefault.end,
  minAndroid: j.minAppVersion?.android ?? '', minIos: j.minAppVersion?.ios ?? '', timezone: j.timezone,
});

/** Only fields that differ from the loaded settings go on the wire. */
function diff(form: Form, base: Form): JuviSettingsPatch {
  const p: JuviSettingsPatch = {};
  if (form.enabled !== base.enabled) p.enabled = form.enabled;
  if (form.paused !== base.paused) p.paused = form.paused;
  if (form.pausedMessage !== base.pausedMessage) p.pausedMessage = form.pausedMessage;
  if (form.accentColor !== base.accentColor && form.accentColor) p.accentColor = form.accentColor;
  if (form.contactName !== base.contactName || form.contactPhone !== base.contactPhone || form.contactEmail !== base.contactEmail) {
    p.supportContact = { name: form.contactName, ...(form.contactPhone ? { phone: form.contactPhone } : {}), ...(form.contactEmail ? { email: form.contactEmail } : {}) };
  }
  if (form.quietStart !== base.quietStart || form.quietEnd !== base.quietEnd) p.quietHoursDefault = { start: form.quietStart, end: form.quietEnd };
  if (form.minAndroid !== base.minAndroid || form.minIos !== base.minIos) {
    p.minAppVersion = { ...(form.minAndroid ? { android: form.minAndroid } : {}), ...(form.minIos ? { ios: form.minIos } : {}) };
  }
  if (form.timezone !== base.timezone) p.timezone = form.timezone;
  return p;
}

function validate(form: Form): Record<string, string> {
  const e: Record<string, string> = {};
  if (form.accentColor && !HEX.test(form.accentColor)) e.accentColor = 'Use a hex colour like #0B5FA5';
  if (!HHMM.test(form.quietStart) || !HHMM.test(form.quietEnd)) e.quiet = 'Use 24-hour times like 22:00';
  if (form.paused && !form.pausedMessage.trim()) e.pausedMessage = 'Tell users why Juvi is paused';
  if (form.contactEmail && !/^\S+@\S+\.\S+$/.test(form.contactEmail)) e.contactEmail = 'Enter a valid email';
  return e;
}

export default function SettingsTab() {
  const qc = useQueryClient();
  const canUpdate = useAuthStore((s) => s.hasPermission('platform', 'update'));
  const { data, isLoading } = useQuery({ queryKey: ['juvi-admin-settings'], queryFn: getJuviSettings });
  const [form, setForm] = useState<Form | null>(null);
  const [base, setBase] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { if (data) { const f = toForm(data.juvi); setForm(f); setBase(f); } }, [data]);

  const save = useMutation({
    mutationFn: (patch: JuviSettingsPatch) => updateJuviSettings(patch),
    onSuccess: (view) => { qc.setQueryData(['juvi-admin-settings'], view); toast.success('Juvi settings saved'); },
    onError: () => toast.error('Could not save settings'),
  });
  const reconcile = useMutation({
    mutationFn: () => reconcileNow(),
    onSuccess: () => { toast.success('Reconcile queued'); setTimeout(() => qc.invalidateQueries({ queryKey: ['juvi-admin-settings'] }), 3000); },
    onError: () => toast.error('Could not queue a reconcile'),
  });

  if (isLoading || !form || !base) return <div className="text-sm text-gray-500">Loading settings…</div>;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });

  const onSave = () => {
    const e = validate(form); setErrors(e);
    if (Object.keys(e).length) return;
    const patch = diff(form, base);
    if (Object.keys(patch).length === 0) { toast.success('Nothing to save'); return; }
    save.mutate(patch);
  };

  const lr = data?.lastReconcile;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5 bg-white border rounded-xl p-5">
        <fieldset className="space-y-3">
          <legend className="font-semibold text-navy text-sm mb-2">Availability</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} disabled={!canUpdate} />
            Enable Juvi for this college
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.paused} onChange={(e) => set('paused', e.target.checked)} disabled={!canUpdate} />
            Pause Juvi (every app user sees a full-screen notice)
          </label>
          {form.paused && (
            <div>
              <label htmlFor="pausedMessage" className={lbl}>Message shown to users</label>
              <textarea id="pausedMessage" className={inp} rows={2} value={form.pausedMessage} onChange={(e) => set('pausedMessage', e.target.value)} disabled={!canUpdate} />
              {errors.pausedMessage && <p className="text-xs text-red-600 mt-1">{errors.pausedMessage}</p>}
            </div>
          )}
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="font-semibold text-navy text-sm mb-2">Branding and contact</legend>
          <div>
            <label htmlFor="accentColor" className={lbl}>Accent colour</label>
            <input id="accentColor" className={inp} placeholder="#0B5FA5" value={form.accentColor} onChange={(e) => set('accentColor', e.target.value)} disabled={!canUpdate} />
            {errors.accentColor && <p className="text-xs text-red-600 mt-1">{errors.accentColor}</p>}
          </div>
          <div>
            <label htmlFor="timezone" className={lbl}>Timezone</label>
            <input id="timezone" className={inp} value={form.timezone} onChange={(e) => set('timezone', e.target.value)} disabled={!canUpdate} />
          </div>
          <div>
            <label htmlFor="contactName" className={lbl}>Support contact name</label>
            <input id="contactName" className={inp} value={form.contactName} onChange={(e) => set('contactName', e.target.value)} disabled={!canUpdate} />
          </div>
          <div>
            <label htmlFor="contactPhone" className={lbl}>Support phone</label>
            <input id="contactPhone" className={inp} value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} disabled={!canUpdate} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="contactEmail" className={lbl}>Support email</label>
            <input id="contactEmail" className={inp} value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} disabled={!canUpdate} />
            {errors.contactEmail && <p className="text-xs text-red-600 mt-1">{errors.contactEmail}</p>}
          </div>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="font-semibold text-navy text-sm mb-2">Defaults and versions</legend>
          <div>
            <label htmlFor="quietStart" className={lbl}>Quiet hours start</label>
            <input id="quietStart" className={inp} value={form.quietStart} onChange={(e) => set('quietStart', e.target.value)} disabled={!canUpdate} />
          </div>
          <div>
            <label htmlFor="quietEnd" className={lbl}>Quiet hours end</label>
            <input id="quietEnd" className={inp} value={form.quietEnd} onChange={(e) => set('quietEnd', e.target.value)} disabled={!canUpdate} />
            {errors.quiet && <p className="text-xs text-red-600 mt-1">{errors.quiet}</p>}
          </div>
          <div>
            <label htmlFor="minAndroid" className={lbl}>Minimum app version (Android)</label>
            <input id="minAndroid" className={inp} placeholder="1.0.0" value={form.minAndroid} onChange={(e) => set('minAndroid', e.target.value)} disabled={!canUpdate} />
          </div>
          <div>
            <label htmlFor="minIos" className={lbl}>Minimum app version (iOS)</label>
            <input id="minIos" className={inp} placeholder="1.0.0" value={form.minIos} onChange={(e) => set('minIos', e.target.value)} disabled={!canUpdate} />
          </div>
        </fieldset>

        <div className="flex justify-end">
          <button type="button" onClick={onSave} disabled={!canUpdate || save.isPending}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
            <Save size={16} /> Save settings
          </button>
        </div>
      </div>

      <aside className="bg-white border rounded-xl p-5 space-y-3 text-sm">
        <h3 className="font-semibold text-navy">Last reconcile</h3>
        {lr ? (
          <>
            <p className="text-gray-700">{lr.channels.total} channels · +{lr.memberships.added} / −{lr.memberships.removed} memberships · {lr.errors} errors</p>
            <p className="text-xs text-gray-500">{new Date(lr.at).toLocaleString('en-IN')} · {Math.round(lr.durationMs / 1000)}s</p>
          </>
        ) : (
          <p className="text-gray-500">No reconcile has run yet. It runs every 5 minutes once Juvi is enabled.</p>
        )}
        <button type="button" onClick={() => reconcile.mutate()} disabled={!canUpdate || reconcile.isPending || !data?.juvi.enabled}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded border disabled:opacity-50">
          <RefreshCw size={14} /> Reconcile now
        </button>
      </aside>
    </div>
  );
}
