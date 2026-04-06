import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSections, createSection, updateSection, deleteSection, listBranches, listBatches } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function SectionsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', branchId: '', batchId: '', year: '', semester: '', capacity: '60', classAdvisorId: '' });

  const { data, isLoading } = useQuery({ queryKey: ['sections', page], queryFn: () => listSections(page, 20) });
  const { data: branchData } = useQuery({ queryKey: ['branches', 1, 100], queryFn: () => listBranches(1, 100) });
  const { data: batchData } = useQuery({ queryKey: ['batches', 1, 100], queryFn: () => listBatches(1, 100) });

  const createMut = useMutation({ mutationFn: createSection, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sections'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateSection(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['sections'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteSection, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sections'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); } });

  function openCreate() { setEditing(null); setForm({ name: '', branchId: '', batchId: '', year: '', semester: '', capacity: '60', classAdvisorId: '' }); setModalOpen(true); }
  function openEdit(row: any) {
    setEditing(row);
    setForm({ name: row.name, branchId: row.branchId?._id || row.branchId || '', batchId: row.batchId?._id || row.batchId || '', year: String(row.year), semester: String(row.semester), capacity: String(row.capacity), classAdvisorId: row.classAdvisorId?._id || row.classAdvisorId || '' });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, year: Number(form.year), semester: Number(form.semester), capacity: Number(form.capacity) };
    if (!payload.classAdvisorId) delete payload.classAdvisorId;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'name', label: 'Section', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'year', label: 'Year' },
    { key: 'semester', label: 'Semester' },
    { key: 'capacity', label: 'Capacity' },
    { key: 'createdAt', label: 'Created', render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this section?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Sections</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Section
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Section' : 'New Section'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="e.g. A, B, C" /></div>
            <div><label className={lbl}>Capacity</label><input type="number" min={1} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Branch *</label>
              <select required value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))} className={inp}>
                <option value="">Select branch...</option>
                {branchData?.items?.map((b: any) => <option key={b._id} value={b._id}>{b.code} — {b.name}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Batch *</label>
              <select required value={form.batchId} onChange={e => setForm(f => ({ ...f, batchId: e.target.value }))} className={inp}>
                <option value="">Select batch...</option>
                {batchData?.items?.map((b: any) => <option key={b._id} value={b._id}>{b.code} — {b.name}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Year *</label><input required type="number" min={1} max={6} value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className={inp} placeholder="e.g. 1, 2, 3, 4" /></div>
            <div><label className={lbl}>Semester *</label><input required type="number" min={1} max={12} value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))} className={inp} placeholder="e.g. 1, 2" /></div>
            <div className="col-span-2"><label className={lbl}>Class Advisor (Faculty ID)</label><input value={form.classAdvisorId} onChange={e => setForm(f => ({ ...f, classAdvisorId: e.target.value }))} className={inp} placeholder="Optional — Faculty ObjectId" /></div>
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
