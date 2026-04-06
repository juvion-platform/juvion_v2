import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType } from '../../services/hr';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function LeaveTypesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', code: '', maxDaysPerYear: '', isCarryForward: false, maxCarryForward: '', applicableTo: '' });

  const { data, isLoading } = useQuery({ queryKey: ['leave-types', page], queryFn: () => listLeaveTypes(page, 20) });

  const createMut = useMutation({ mutationFn: createLeaveType, onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-types'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateLeaveType(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-types'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteLeaveType, onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-types'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ name: '', code: '', maxDaysPerYear: '', isCarryForward: false, maxCarryForward: '', applicableTo: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      name: row.name || '',
      code: row.code || '',
      maxDaysPerYear: row.maxDaysPerYear != null ? String(row.maxDaysPerYear) : '',
      isCarryForward: row.isCarryForward || false,
      maxCarryForward: row.maxCarryForward != null ? String(row.maxCarryForward) : '',
      applicableTo: Array.isArray(row.applicableTo) ? row.applicableTo.join(',') : (row.applicableTo || ''),
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (form.maxDaysPerYear) payload.maxDaysPerYear = Number(form.maxDaysPerYear);
    else delete payload.maxDaysPerYear;
    if (form.maxCarryForward) payload.maxCarryForward = Number(form.maxCarryForward);
    else delete payload.maxCarryForward;
    if (form.applicableTo) payload.applicableTo = form.applicableTo.split(',').map((s: string) => s.trim()).filter(Boolean);
    else delete payload.applicableTo;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'code', label: 'Code' },
    { key: 'maxDaysPerYear', label: 'Max Days' },
    { key: 'isCarryForward', label: 'Carry Forward', render: (r: any) => <Badge variant={r.isCarryForward ? 'success' : 'default'}>{r.isCarryForward ? 'Yes' : 'No'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this leave type?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Leave Types</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Leave Type
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Leave Type' : 'New Leave Type'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Code *</label><input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Max Days Per Year *</label><input required type="number" min={0} value={form.maxDaysPerYear} onChange={e => setForm(f => ({ ...f, maxDaysPerYear: e.target.value }))} className={inp} /></div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="isCarryForward" checked={form.isCarryForward} onChange={e => setForm(f => ({ ...f, isCarryForward: e.target.checked }))} className="rounded border-gray-300" />
              <label htmlFor="isCarryForward" className="text-sm font-medium text-gray-700">Carry Forward</label>
            </div>
            <div><label className={lbl}>Max Carry Forward</label><input type="number" min={0} value={form.maxCarryForward} onChange={e => setForm(f => ({ ...f, maxCarryForward: e.target.value }))} className={inp} placeholder="Optional" /></div>
            <div><label className={lbl}>Applicable To</label><input value={form.applicableTo} onChange={e => setForm(f => ({ ...f, applicableTo: e.target.value }))} className={inp} placeholder="comma-separated: teaching,non_teaching,contract,all" /></div>
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
