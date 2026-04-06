import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listRegulations, createRegulation, updateRegulation, deleteRegulation } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function RegulationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ code: '', name: '', effectiveFromYear: '', effectiveToYear: '', totalCredits: '', maxYears: '', isActive: true });

  const { data, isLoading } = useQuery({
    queryKey: ['regulations', page],
    queryFn: () => listRegulations(page, 20),
  });

  const createMut = useMutation({ mutationFn: createRegulation, onSuccess: () => { qc.invalidateQueries({ queryKey: ['regulations'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateRegulation(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['regulations'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteRegulation, onSuccess: () => { qc.invalidateQueries({ queryKey: ['regulations'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ code: '', name: '', effectiveFromYear: '', effectiveToYear: '', totalCredits: '', maxYears: '', isActive: true });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({ code: row.code, name: row.name, effectiveFromYear: String(row.effectiveFromYear), effectiveToYear: row.effectiveToYear ? String(row.effectiveToYear) : '', totalCredits: String(row.totalCredits), maxYears: String(row.maxYears), isActive: row.isActive });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, effectiveFromYear: Number(form.effectiveFromYear), totalCredits: Number(form.totalCredits), maxYears: Number(form.maxYears) };
    if (form.effectiveToYear) payload.effectiveToYear = Number(form.effectiveToYear); else delete payload.effectiveToYear;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'code', label: 'Code', render: (r: any) => <span className="font-medium text-navy">{r.code}</span> },
    { key: 'name', label: 'Name' },
    { key: 'effectiveFromYear', label: 'From', render: (r: any) => r.effectiveFromYear },
    { key: 'effectiveToYear', label: 'To', render: (r: any) => r.effectiveToYear || '—' },
    { key: 'totalCredits', label: 'Credits' },
    { key: 'maxYears', label: 'Max Yrs' },
    { key: 'isActive', label: 'Status', render: (r: any) => <Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this regulation?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Regulations</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Regulation
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Regulation' : 'New Regulation'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Code *</label><input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className={inp} placeholder="e.g. R20" /></div>
            <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="e.g. Regulation 2020" /></div>
            <div><label className={lbl}>Effective From Year *</label><input required type="number" value={form.effectiveFromYear} onChange={e => setForm(f => ({ ...f, effectiveFromYear: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Effective To Year</label><input type="number" value={form.effectiveToYear} onChange={e => setForm(f => ({ ...f, effectiveToYear: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Total Credits *</label><input required type="number" value={form.totalCredits} onChange={e => setForm(f => ({ ...f, totalCredits: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Max Years *</label><input required type="number" value={form.maxYears} onChange={e => setForm(f => ({ ...f, maxYears: e.target.value }))} className={inp} /></div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
              <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
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
