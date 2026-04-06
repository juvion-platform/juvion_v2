import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listBuildings, createBuilding, updateBuilding, deleteBuilding } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function BuildingsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', code: '', floors: '', totalRooms: '', location: '', isActive: true });

  const { data, isLoading } = useQuery({ queryKey: ['buildings', page], queryFn: () => listBuildings(page, 20) });

  const createMut = useMutation({ mutationFn: createBuilding, onSuccess: () => { qc.invalidateQueries({ queryKey: ['buildings'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateBuilding(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['buildings'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteBuilding, onSuccess: () => { qc.invalidateQueries({ queryKey: ['buildings'] }); } });

  function openCreate() { setEditing(null); setForm({ name: '', code: '', floors: '', totalRooms: '', location: '', isActive: true }); setModalOpen(true); }
  function openEdit(row: any) {
    setEditing(row);
    setForm({ name: row.name || '', code: row.code || '', floors: String(row.floors ?? ''), totalRooms: String(row.totalRooms ?? ''), location: row.location || '', isActive: row.isActive !== false });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, floors: Number(form.floors), totalRooms: Number(form.totalRooms) };
    if (!payload.location) delete payload.location;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'code', label: 'Code' },
    { key: 'floors', label: 'Floors' },
    { key: 'totalRooms', label: 'Rooms' },
    { key: 'location', label: 'Location', render: (r: any) => r.location || '\u2014' },
    { key: 'isActive', label: 'Status', render: (r: any) => <Badge variant={r.isActive !== false ? 'success' : 'default'}>{r.isActive !== false ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this building?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Buildings</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} /> New Building</button>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Building' : 'New Building'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Code *</label><input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Floors *</label><input required type="number" min={0} value={form.floors} onChange={e => setForm(f => ({ ...f, floors: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Total Rooms *</label><input required type="number" min={0} value={form.totalRooms} onChange={e => setForm(f => ({ ...f, totalRooms: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Location</label><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Active</label><select value={String(form.isActive)} onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'true' }))} className={inp}><option value="true">Yes</option><option value="false">No</option></select></div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{createMut.isPending || updateMut.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
