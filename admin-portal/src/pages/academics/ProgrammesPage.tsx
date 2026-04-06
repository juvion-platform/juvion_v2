import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listProgrammes, createProgramme, updateProgramme, deleteProgramme, listRegulations } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const LEVELS = ['UG', 'PG', 'Diploma', 'PhD'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function ProgrammesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ code: '', name: '', level: 'UG', durationYears: '', regulationId: '', isActive: true });

  const { data, isLoading } = useQuery({ queryKey: ['programmes', page], queryFn: () => listProgrammes(page, 20) });
  const { data: regsData } = useQuery({ queryKey: ['regulations', 1, 100], queryFn: () => listRegulations(1, 100) });

  const createMut = useMutation({ mutationFn: createProgramme, onSuccess: () => { qc.invalidateQueries({ queryKey: ['programmes'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateProgramme(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['programmes'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteProgramme, onSuccess: () => { qc.invalidateQueries({ queryKey: ['programmes'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ code: '', name: '', level: 'UG', durationYears: '', regulationId: '', isActive: true });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({ code: row.code, name: row.name, level: row.level, durationYears: String(row.durationYears), regulationId: row.regulationId?._id || row.regulationId || '', isActive: row.isActive });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, durationYears: Number(form.durationYears) };
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'code', label: 'Code', render: (r: any) => <span className="font-medium text-navy">{r.code}</span> },
    { key: 'name', label: 'Name' },
    { key: 'level', label: 'Level', render: (r: any) => <Badge variant="info">{r.level}</Badge> },
    { key: 'durationYears', label: 'Duration', render: (r: any) => `${r.durationYears} yrs` },
    { key: 'isActive', label: 'Status', render: (r: any) => <Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this programme?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Programmes</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Programme
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Programme' : 'New Programme'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Code *</label><input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className={inp} placeholder="e.g. BTECH" /></div>
            <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="e.g. Bachelor of Technology" /></div>
            <div><label className={lbl}>Level *</label>
              <select required value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} className={inp}>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Duration (Years) *</label><input required type="number" min={1} value={form.durationYears} onChange={e => setForm(f => ({ ...f, durationYears: e.target.value }))} className={inp} /></div>
            <div className="col-span-2"><label className={lbl}>Regulation *</label>
              <select required value={form.regulationId} onChange={e => setForm(f => ({ ...f, regulationId: e.target.value }))} className={inp}>
                <option value="">Select regulation...</option>
                {regsData?.items?.map((r: any) => <option key={r._id} value={r._id}>{r.code} — {r.name}</option>)}
              </select>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="pgIsActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
              <label htmlFor="pgIsActive" className="text-sm text-gray-700">Active</label>
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
