import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { listProgrammes, listBatches, listDepartments } from '../../../services/academics';
import { createRun, type AccountKind, type CreateRunInput, type ProvisioningRun } from '../../../services/juvi-app';
import { toast } from '../../../stores/toastStore';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

export default function NewRunForm({ onCreated, onCancel }: { onCreated: (run: ProvisioningRun) => void; onCancel: () => void }) {
  const [kinds, setKinds] = useState<AccountKind[]>(['student']);
  const [programmeId, setProgrammeId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  // Off by default (R38): the User is shared with the ERP web login, so a reset also changes the portal password.
  const [reset, setReset] = useState(false);

  // services/academics exports `list*(page = 1, limit = 20, search?)`; 200 covers any college's structure.
  const programmes = useQuery({ queryKey: ['programmes', 'all'], queryFn: () => listProgrammes(1, 200) });
  const batches = useQuery({ queryKey: ['batches', 'all'], queryFn: () => listBatches(1, 200) });
  const departments = useQuery({ queryKey: ['departments', 'all'], queryFn: () => listDepartments(1, 200) });

  const start = useMutation({
    mutationFn: (input: CreateRunInput) => createRun(input),
    // The global MutationCache in main.tsx would otherwise toast this mutation
    // a second time on top of the messages below.
    meta: { silent: true, silentError: true },
    onSuccess: (run) => { toast.success('Provisioning run started'); onCreated(run); },
    onError: () => toast.error('Could not start the run'),
  });

  const toggle = (k: AccountKind) => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));
  const submit = () => {
    if (kinds.length === 0) { toast.warning('Pick at least one kind'); return; }
    start.mutate({
      kinds,
      ...(programmeId ? { programmeIds: [programmeId] } : {}),
      ...(batchId ? { batchIds: [batchId] } : {}),
      ...(departmentId ? { departmentIds: [departmentId] } : {}),
      resetExistingPasswords: reset,
    });
  };

  return (
    <div className="bg-white border rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-navy">New provisioning run</h3>
      <fieldset className="flex gap-4 text-sm">
        <legend className={lbl}>Who</legend>
        {(['student', 'faculty', 'staff'] as AccountKind[]).map((k) => (
          <label key={k} className="flex items-center gap-2 capitalize">
            <input type="checkbox" checked={kinds.includes(k)} onChange={() => toggle(k)} aria-label={k} /> {k}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="run-programme" className={lbl}>Programme</label>
          <select id="run-programme" className={inp} value={programmeId} onChange={(e) => setProgrammeId(e.target.value)}>
            <option value="">All programmes</option>
            {programmes.data?.items?.map((p: any) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="run-batch" className={lbl}>Batch</label>
          <select id="run-batch" className={inp} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">All batches</option>
            {batches.data?.items?.map((b: any) => <option key={b._id} value={b._id}>{b.name ?? b.code}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="run-department" className={lbl}>Department</label>
          <select id="run-department" className={inp} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All departments</option>
            {departments.data?.items?.map((d: any) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={reset} onChange={(e) => setReset(e.target.checked)} />
        Reset passwords of people who already have a login. This also replaces their ERP portal password — they will need the new temporary password to sign in anywhere.
      </label>
      <p className="text-xs text-gray-500">Temporary passwords are stored encrypted for 7 days. Export them per section from the run once it completes.</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded border">Cancel</button>
        <button type="button" onClick={submit} disabled={start.isPending}
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
          <Play size={16} /> Start run
        </button>
      </div>
    </div>
  );
}
