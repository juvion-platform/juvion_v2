import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listExitProcesses, createExitProcess, updateExitProcess, deleteExitProcess, listEmployees } from '../../services/hr';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const EXIT_TYPES = ['resignation', 'retirement', 'termination', 'contract_end'] as const;
const STATUSES = ['initiated', 'in_progress', 'completed'] as const;
const STATUS_COLOR: Record<string, string> = { initiated: 'default', in_progress: 'warning', completed: 'success' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function ExitProcessPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    employeeId: '', exitType: 'resignation' as string, lastWorkingDate: '',
    reason: '', exitInterviewDone: false, status: 'initiated' as string,
  });

  const { data, isLoading } = useQuery({ queryKey: ['exit-processes', page], queryFn: () => listExitProcesses(page, 20) });
  const { data: employeesData } = useQuery({ queryKey: ['employees-all'], queryFn: () => listEmployees(1, 200) });

  const employees = employeesData?.items || [];

  const createMut = useMutation({ mutationFn: createExitProcess, onSuccess: () => { qc.invalidateQueries({ queryKey: ['exit-processes'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateExitProcess(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['exit-processes'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteExitProcess, onSuccess: () => { qc.invalidateQueries({ queryKey: ['exit-processes'] }); } });

  function employeeDisplayName(e: any): string {
    return e.personId?.name || e.employeeId || e._id;
  }

  function openCreate() {
    setEditing(null);
    setForm({ employeeId: '', exitType: 'resignation', lastWorkingDate: '', reason: '', exitInterviewDone: false, status: 'initiated' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      employeeId: row.employeeId?._id || row.employeeId || '',
      exitType: row.exitType || 'resignation',
      lastWorkingDate: row.lastWorkingDate ? row.lastWorkingDate.slice(0, 10) : '',
      reason: row.reason || '',
      exitInterviewDone: row.exitInterviewDone || false,
      status: row.status || 'initiated',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'employeeId', label: 'Employee', render: (r: any) => <span className="font-medium text-navy">{r.employeeId?.personId?.name || r.employeeId?.employeeId || '\u2014'}</span> },
    { key: 'exitType', label: 'Exit Type', render: (r: any) => <Badge variant="info">{r.exitType}</Badge> },
    { key: 'lastWorkingDate', label: 'Last Working Date', render: (r: any) => r.lastWorkingDate ? new Date(r.lastWorkingDate).toLocaleDateString() : '\u2014' },
    { key: 'exitInterviewDone', label: 'Interview Done', render: (r: any) => r.exitInterviewDone ? <Badge variant="success">Yes</Badge> : <Badge variant="default">No</Badge> },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this exit process?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Exit Processes</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Exit Process
        </button>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Exit Process' : 'New Exit Process'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Employee * <Link to="/hr/employees" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={inp}>
                <option value="">Select employee...</option>
                {employees.map((emp: any) => <option key={emp._id} value={emp._id}>{employeeDisplayName(emp)}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Exit Type *</label>
              <select required value={form.exitType} onChange={e => setForm(f => ({ ...f, exitType: e.target.value }))} className={inp}>
                {EXIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Last Working Date *</label>
              <input type="date" required value={form.lastWorkingDate} onChange={e => setForm(f => ({ ...f, lastWorkingDate: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Reason *</label>
              <input required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className={inp} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="exitInterviewDone" checked={form.exitInterviewDone} onChange={e => setForm(f => ({ ...f, exitInterviewDone: e.target.checked }))} className="rounded border-gray-300" />
              <label htmlFor="exitInterviewDone" className="text-sm font-medium text-gray-700">Exit Interview Done</label>
            </div>
            <div><label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              {createMut.isPending || updateMut.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
