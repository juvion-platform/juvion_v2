import { CheckCircle2, XCircle, Loader2, AlertTriangle, Clock } from 'lucide-react';
import type { ProvisioningRun, RunStatus } from '../../../services/juvi-app';

const META: Record<RunStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  queued:    { label: 'Queued',    cls: 'bg-slate-50 text-slate-700 border-slate-200',        Icon: Clock },
  running:   { label: 'Running',   cls: 'bg-blue-50 text-blue-700 border-blue-200',          Icon: Loader2 },
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
  partial:   { label: 'Partial',   cls: 'bg-amber-50 text-amber-800 border-amber-200',       Icon: AlertTriangle },
  failed:    { label: 'Failed',    cls: 'bg-red-50 text-red-800 border-red-200',             Icon: XCircle },
};

export function RunStatusPill({ status }: { status: RunStatus }) {
  const m = META[status]; const Icon = m.Icon;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${m.cls}`}><Icon size={11} /> {m.label}</span>;
}

export default function RunsTable({ runs, onSelect }: { runs: ProvisioningRun[]; onSelect: (run: ProvisioningRun) => void }) {
  if (runs.length === 0) {
    return <div className="border rounded-xl p-8 text-center text-sm text-gray-500 bg-white">No provisioning runs yet. Start one to create app accounts for your students and faculty.</div>;
  }
  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
          <tr><th className="px-4 py-2">Started</th><th className="px-4 py-2">Kinds</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Results</th><th className="px-4 py-2">By</th><th className="px-4 py-2" /></tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r._id} className="border-t">
              <td className="px-4 py-2 whitespace-nowrap">{new Date(r.startedAt ?? r.createdAt).toLocaleString('en-IN')}</td>
              <td className="px-4 py-2">{r.filter.kinds.join(', ')}</td>
              <td className="px-4 py-2"><RunStatusPill status={r.status} /></td>
              <td className="px-4 py-2 text-gray-700">{r.counts.created} created · {r.counts.existingLinked} linked · {r.counts.skipped} skipped · {r.counts.failed} failed</td>
              <td className="px-4 py-2">{r.performedBy}</td>
              <td className="px-4 py-2 text-right">
                <button type="button" onClick={() => onSelect(r)} className="text-primary-700 hover:underline text-sm">Open run</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
