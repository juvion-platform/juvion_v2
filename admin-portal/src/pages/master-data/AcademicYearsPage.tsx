import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAcademicYears, createAcademicYear, updateAcademicYear, deleteAcademicYear } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function AcademicYearsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ code: '', label: '', startDate: '', endDate: '', isCurrent: false });

  const { data, isLoading } = useQuery({ queryKey: ['academic-years', page], queryFn: () => listAcademicYears(page, 20) });

  const createMut = useMutation({ mutationFn: createAcademicYear, onSuccess: () => { qc.invalidateQueries({ queryKey: ['academic-years'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateAcademicYear(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['academic-years'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteAcademicYear, onSuccess: () => { qc.invalidateQueries({ queryKey: ['academic-years'] }); } });

  function openCreate() { setEditing(null); setForm({ code: '', label: '', startDate: '', endDate: '', isCurrent: false }); setModalOpen(true); }
  function openEdit(row: any) {
    setEditing(row);
    setForm({ code: row.code, label: row.label, startDate: row.startDate?.substring(0, 10) || '', endDate: row.endDate?.substring(0, 10) || '', isCurrent: row.isCurrent });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) updateMut.mutate({ id: editing._id, data: form });
    else createMut.mutate(form);
  }

  const columns = [
    { key: 'code', label: 'Code', render: (r: any) => <span className="font-medium text-navy">{r.code}</span> },
    { key: 'label', label: 'Label' },
    { key: 'startDate', label: 'Start', render: (r: any) => new Date(r.startDate).toLocaleDateString() },
    { key: 'endDate', label: 'End', render: (r: any) => new Date(r.endDate).toLocaleDateString() },
    { key: 'isCurrent', label: 'Current', render: (r: any) => r.isCurrent ? <Badge variant="success">Current</Badge> : <span className="text-gray-400 text-xs">{'\u2014'}</span> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this academic year?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Academic Years</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Academic Year
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
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Academic Year' : 'New Academic Year'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Code *</label><input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className={inp} placeholder="e.g. 2025-26" /></div>
            <div><label className={lbl}>Label *</label><input required value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className={inp} placeholder="e.g. Academic Year 2025-26" /></div>
            <div><label className={lbl}>Start Date *</label><input required type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>End Date *</label><input required type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={inp} /></div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="isCurrent" checked={form.isCurrent} onChange={e => setForm(f => ({ ...f, isCurrent: e.target.checked }))} className="rounded" />
              <label htmlFor="isCurrent" className="text-sm text-gray-700">Mark as Current Year</label>
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
