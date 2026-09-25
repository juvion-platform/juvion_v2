import { useMutation, useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { getCredentialGroups, downloadCredentialsCsv, saveBlob, type CredentialGroup, type ProvisioningRun } from '../../../services/juvi-app';
import { useAuthStore } from '../../../stores/authStore';
import { toast } from '../../../stores/toastStore';
import { RunStatusPill } from './RunsTable';

export default function CredentialsDownload({ run }: { run: ProvisioningRun }) {
  const canExport = useAuthStore((s) => s.hasPermission('platform', 'create'));
  const groups = useQuery({ queryKey: ['juvi-credential-groups', run._id], queryFn: () => getCredentialGroups(run._id), refetchInterval: run.status === 'running' || run.status === 'queued' ? 3000 : false });
  const download = useMutation({
    mutationFn: (g: CredentialGroup) => downloadCredentialsCsv(run._id, { key: g.key, id: g.id }),
    // The global MutationCache in main.tsx would otherwise toast this mutation
    // a second time on top of the messages below.
    meta: { silent: true, silentError: true },
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
    onError: () => toast.error('These credentials have expired. Reset passwords from the accounts table.'),
  });

  return (
    <div className="bg-white border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-navy">Run {run._id.slice(-6)}</h3>
        <RunStatusPill status={run.status} />
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
        {(['scanned', 'created', 'existingLinked', 'skipped', 'failed'] as const).map((k) => (
          <div key={k}><dt className="text-xs text-gray-500 capitalize">{k === 'existingLinked' ? 'Linked existing' : k}</dt><dd className="font-semibold">{run.counts[k]}</dd></div>
        ))}
      </dl>
      {run.errors.length > 0 && (
        <details className="text-sm"><summary className="cursor-pointer text-red-700">{run.errors.length} failures</summary>
          <ul className="mt-2 space-y-1 text-xs text-gray-700">{run.errors.map((e, i) => <li key={i}>{e.personId}: {e.reason}</li>)}</ul>
        </details>
      )}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Credential exports</h4>
        {groups.data?.live === false ? (
          <p className="text-sm text-gray-500">The temporary passwords for this run have expired. Reset a password from the accounts table to issue a new one.</p>
        ) : (
          <ul className="space-y-2">
            {groups.data?.groups.map((g) => (
              <li key={`${g.key}:${g.id}`} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                <span>{g.label} <span className="text-gray-500">· {g.count}</span></span>
                <button type="button" disabled={!canExport || download.isPending} onClick={() => download.mutate(g)} aria-label={`Download ${g.label}`}
                  className="inline-flex items-center gap-1 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 rounded border disabled:opacity-50">
                  <Download size={14} /> CSV
                </button>
              </li>
            ))}
          </ul>
        )}
        {groups.data?.expiresAt && groups.data.live && <p className="text-xs text-gray-500 mt-2">Available until {new Date(groups.data.expiresAt).toLocaleString('en-IN')}.</p>}
      </div>
    </div>
  );
}
