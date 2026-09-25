import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import { getJuviSettings, listRuns, type ProvisioningRun } from '../../../services/juvi-app';
import { useAuthStore } from '../../../stores/authStore';
import NewRunForm from './NewRunForm';
import RunsTable from './RunsTable';
import CredentialsDownload from './CredentialsDownload';
import AccountsTable from './AccountsTable';

type Mode = { kind: 'list' } | { kind: 'new' } | { kind: 'run'; run: ProvisioningRun };

export default function ProvisioningTab() {
  const canCreate = useAuthStore((s) => s.hasPermission('platform', 'create'));
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  // Shares its cache with the Settings tab, so enabling Juvi there reveals "New run" here.
  const settings = useQuery({ queryKey: ['juvi-admin-settings'], queryFn: getJuviSettings });
  const enabled = Boolean(settings.data?.juvi.enabled);
  const runs = useQuery({
    queryKey: ['juvi-runs'], queryFn: () => listRuns(1, 20),
    refetchInterval: (q) => (q.state.data?.items.some((r) => r.status === 'queued' || r.status === 'running') ? 3000 : false),
  });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-navy">Provisioning runs</h3>
          {mode.kind === 'list' && canCreate && settings.data && !enabled && (
            <p className="text-sm text-gray-500">Enable Juvi in Settings to start provisioning.</p>
          )}
          {mode.kind === 'list' && canCreate && enabled && (
            <button type="button" onClick={() => setMode({ kind: 'new' })} className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} /> New run</button>
          )}
          {mode.kind !== 'list' && (
            <button type="button" onClick={() => setMode({ kind: 'list' })} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded border"><ArrowLeft size={14} /> Back to runs</button>
          )}
        </div>
        {mode.kind === 'list' && <RunsTable runs={runs.data?.items ?? []} onSelect={(run) => setMode({ kind: 'run', run })} />}
        {mode.kind === 'new' && <NewRunForm onCreated={(run) => { runs.refetch(); setMode({ kind: 'run', run }); }} onCancel={() => setMode({ kind: 'list' })} />}
        {mode.kind === 'run' && <CredentialsDownload run={runs.data?.items.find((r) => r._id === mode.run._id) ?? mode.run} />}
      </section>
      <section className="space-y-3">
        <h3 className="font-semibold text-navy">Accounts</h3>
        <AccountsTable />
      </section>
    </div>
  );
}
