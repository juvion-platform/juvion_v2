import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPayStructures, createPayStructure, updatePayStructure, deletePayStructure, listEmployees } from '../../services/hr';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function PayStructuresPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ employeeId: '', basicPay: '', hra: '', da: '', otherAllowances: '', pfContribution: '', effectiveFrom: '', effectiveTo: '' });

  const { data, isLoading } = useQuery({ queryKey: ['pay-structures', page], queryFn: () => listPayStructures(page, 20) });
  const { data: empData } = useQuery({ queryKey: ['employees-all'], queryFn: () => listEmployees(1, 200) });

  const employees = empData?.items || [];

  const createMut = useMutation({ mutationFn: createPayStructure, onSuccess: () => { qc.invalidateQueries({ queryKey: ['pay-structures'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updatePayStructure(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['pay-structures'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deletePayStructure, onSuccess: () => { qc.invalidateQueries({ queryKey: ['pay-structures'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ employeeId: '', basicPay: '', hra: '', da: '', otherAllowances: '', pfContribution: '', effectiveFrom: '', effectiveTo: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      employeeId: row.employeeId?._id || row.employeeId || '',
      basicPay: String(row.basicPay || ''),
      hra: row.hra != null ? String(row.hra) : '',
      da: row.da != null ? String(row.da) : '',
      otherAllowances: row.otherAllowances != null ? String(row.otherAllowances) : '',
      pfContribution: row.pfContribution != null ? String(row.pfContribution) : '',
      effectiveFrom: row.effectiveFrom ? row.effectiveFrom.slice(0, 10) : '',
      effectiveTo: row.effectiveTo ? row.effectiveTo.slice(0, 10) : '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, basicPay: Number(form.basicPay) };
    if (form.hra) payload.hra = Number(form.hra); else delete payload.hra;
    if (form.da) payload.da = Number(form.da); else delete payload.da;
    if (form.otherAllowances) payload.otherAllowances = Number(form.otherAllowances); else delete payload.otherAllowances;
    if (form.pfContribution) payload.pfContribution = Number(form.pfContribution); else delete payload.pfContribution;
    if (!form.effectiveTo) delete payload.effectiveTo;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'employee', label: 'Employee', render: (r: any) => <span className="font-medium text-navy">{r.employeeId?.personId?.name || r.employeeId?.employeeId || '—'}</span> },
    { key: 'basicPay', label: 'Basic Pay', render: (r: any) => `₹${Number(r.basicPay).toLocaleString()}` },
    { key: 'hra', label: 'HRA', render: (r: any) => `₹${Number(r.hra || 0).toLocaleString()}` },
    { key: 'da', label: 'DA', render: (r: any) => `₹${Number(r.da || 0).toLocaleString()}` },
    { key: 'effectiveFrom', label: 'Effective From', render: (r: any) => r.effectiveFrom ? new Date(r.effectiveFrom).toLocaleDateString() : '—' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this pay structure?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Pay Structures</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Pay Structure
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Pay Structure' : 'New Pay Structure'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Employee * <Link to="/hr/employees" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={inp}>
                <option value="">Select employee</option>
                {employees.map((e: any) => <option key={e._id} value={e._id}>{e.personId?.name || e.employeeId || e._id}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Basic Pay *</label><input required type="number" min={0} value={form.basicPay} onChange={e => setForm(f => ({ ...f, basicPay: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>HRA</label><input type="number" min={0} value={form.hra} onChange={e => setForm(f => ({ ...f, hra: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>DA</label><input type="number" min={0} value={form.da} onChange={e => setForm(f => ({ ...f, da: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Other Allowances</label><input type="number" min={0} value={form.otherAllowances} onChange={e => setForm(f => ({ ...f, otherAllowances: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>PF Contribution</label><input type="number" min={0} value={form.pfContribution} onChange={e => setForm(f => ({ ...f, pfContribution: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Effective From *</label><input required type="date" value={form.effectiveFrom} onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Effective To</label><input type="date" value={form.effectiveTo} onChange={e => setForm(f => ({ ...f, effectiveTo: e.target.value }))} className={inp} /></div>
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
