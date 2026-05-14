import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getERPNextStatus, updateERPNextConfig, testERPNextConnection,
  type ERPNextBridgeConfig,
} from '../../services/platform-config';
import Badge from '../../components/ui/Badge';
import {
  Plug, Save, Activity, AlertTriangle, ExternalLink, RotateCcw,
} from 'lucide-react';

// Strategic Gap 8 — ERPNext / Frappe HR bridge admin surface.
// Phase A: read + edit per-college config + view recent sync attempts
// + run a stub connection test. Outbound HTTP push wires in Phase B.

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

export default function IntegrationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['erpnext-status'],
    queryFn: getERPNextStatus,
  });

  const [draft, setDraft] = useState<Partial<ERPNextBridgeConfig>>({});
  useEffect(() => {
    if (data?.config) setDraft(data.config);
  }, [data?.config]);

  const saveMut = useMutation({
    mutationFn: (patch: Partial<ERPNextBridgeConfig>) => updateERPNextConfig(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erpnext-status'] }),
    onError: (err: any) => alert(err?.response?.data?.error || err?.message || 'Save failed'),
  });

  const testMut = useMutation({
    mutationFn: testERPNextConnection,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erpnext-status'] }),
  });

  if (isLoading) return <div className="text-sm text-gray-400">Loading…</div>;
  if (!data) return <div className="text-sm text-gray-400">No data.</div>;

  const channels = data.config.enabledChannels || [];
  function toggleChannel(name: string) {
    const next = channels.includes(name)
      ? channels.filter((c) => c !== name)
      : [...channels, name];
    setDraft((d) => ({ ...d, enabledChannels: next }));
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="rounded-lg p-2.5 bg-indigo-50 text-indigo-600"><Plug size={20} /></div>
        <div>
          <h2 className="text-xl font-bold text-navy">Integrations</h2>
          <p className="text-xs text-gray-500 mt-0.5">External system bridges. Strategic Gap 8 — ERPNext / Frappe HR is the personnel-side HR engine.</p>
        </div>
      </div>

      {data.phaseANote && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5 flex items-start gap-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>{data.phaseANote}</div>
        </div>
      )}

      {/* Config */}
      <div className="bg-white rounded-xl border shadow-sm p-5 mb-5 max-w-3xl">
        <h3 className="font-semibold text-navy mb-4">ERPNext / Frappe HR</h3>

        <div className="flex items-center gap-3 mb-4">
          <input
            id="erpnext-enabled"
            type="checkbox"
            checked={Boolean(draft.enabled)}
            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
            className="h-4 w-4"
          />
          <label htmlFor="erpnext-enabled" className="text-sm">Bridge Enabled</label>
          <Badge variant={data.config.enabled ? 'success' : 'default'}>
            {data.config.enabled ? 'active' : 'inactive'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={lbl}>ERPNext Base URL</label>
            <input
              type="text"
              value={draft.baseUrl || ''}
              onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
              placeholder="https://erpnext.example-college.in"
              className={inp}
            />
          </div>
          <div>
            <label className={lbl}>Site Name (optional)</label>
            <input
              type="text"
              value={draft.siteName || ''}
              onChange={(e) => setDraft((d) => ({ ...d, siteName: e.target.value }))}
              placeholder="(for multi-tenant ERPNext)"
              className={inp}
            />
          </div>
          <div>
            <label className={lbl}>API Key Reference</label>
            <input
              type="text"
              value={draft.apiKeyRef || ''}
              onChange={(e) => setDraft((d) => ({ ...d, apiKeyRef: e.target.value }))}
              placeholder="ERPNEXT_API_KEY  (env var name; never the raw key)"
              className={inp}
            />
            <p className="text-xs text-gray-500 mt-1">Reference to a secret in the vault — not the raw key.</p>
          </div>
          <div>
            <label className={lbl}>Outbound HTTP Enabled (Phase B)</label>
            <input
              type="checkbox"
              checked={Boolean(draft.outboundEnabled)}
              onChange={(e) => setDraft((d) => ({ ...d, outboundEnabled: e.target.checked }))}
              className="h-4 w-4"
            />
            <p className="text-xs text-gray-500 mt-1">Off in Phase A — the listener records IntegrationLog rows but does not dial out.</p>
          </div>
        </div>

        {/* Channels */}
        <div className="mb-4">
          <label className={lbl}>Sync Channels</label>
          <div className="space-y-2">
            {data.mappings.map((m) => (
              <label
                key={m.juvionEvent}
                className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={channels.includes(m.juvionEvent)}
                  onChange={() => toggleChannel(m.juvionEvent)}
                  className="h-4 w-4 mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{m.juvionEvent}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium">{m.erpnextDocType}</span>
                    <span className="text-xs text-gray-400">{m.method}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{m.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-3 border-t">
          <button
            onClick={() => saveMut.mutate(draft)}
            disabled={saveMut.isPending}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
          >
            <Save size={14} className="text-white" />
            {saveMut.isPending ? 'Saving…' : 'Save Configuration'}
          </button>
          <button
            onClick={() => testMut.mutate()}
            disabled={testMut.isPending || !draft.baseUrl}
            className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <RotateCcw size={14} className="text-gray-500" />
            {testMut.isPending ? 'Testing…' : 'Test Connection'}
          </button>
        </div>

        {testMut.data && (
          <div className={`mt-3 p-3 rounded text-sm ${testMut.data.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
            <strong>{testMut.data.ok ? 'OK' : 'Phase A'}: </strong>
            {testMut.data.message}
          </div>
        )}

        <div className="text-xs text-gray-500 mt-4 pt-3 border-t flex items-center gap-4">
          <span>Success: <strong className="text-emerald-600">{data.config.successCount}</strong></span>
          <span>Failures: <strong className="text-red-600">{data.config.failureCount}</strong></span>
          {data.config.lastSyncAt && (
            <span>Last sync: {new Date(data.config.lastSyncAt).toLocaleString()}</span>
          )}
        </div>
        {data.config.lastError && (
          <div className="text-xs text-red-600 mt-1 font-mono">{data.config.lastError}</div>
        )}
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-navy flex items-center gap-2">
            <Activity size={16} className="text-indigo-500" />
            Recent Sync Attempts
          </h3>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); qc.invalidateQueries({ queryKey: ['erpnext-status'] }); }}
            className="text-xs text-primary-600 hover:underline"
          >
            Refresh
          </a>
        </div>
        {data.recent.length === 0 ? (
          <p className="text-sm text-gray-400">No sync attempts yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left text-xs text-gray-500">
                <th className="py-2">Endpoint</th>
                <th className="py-2">Method</th>
                <th className="py-2">Status</th>
                <th className="py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r._id} className="border-b last:border-b-0">
                  <td className="py-2">
                    <span className="text-xs font-mono truncate inline-flex items-center gap-1 max-w-[400px]">
                      {r.endpoint}
                      <ExternalLink size={10} className="text-gray-300" />
                    </span>
                  </td>
                  <td className="py-2 text-xs">{r.method}</td>
                  <td className="py-2">
                    <Badge variant={r.status === 'success' ? 'success' : r.status === 'failed' ? 'danger' : 'default'}>{r.status}</Badge>
                  </td>
                  <td className="py-2 text-xs text-gray-500">{new Date(r.startedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
