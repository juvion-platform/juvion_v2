import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPlacementTrainings, createPlacementTraining, updatePlacementTraining, deletePlacementTraining } from '../../services/placement';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const TYPES = ['aptitude', 'soft_skills', 'technical', 'mock_interview', 'resume'] as const;
const STATUSES = ['planned', 'ongoing', 'completed'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function PlacementTrainingsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: '', type: 'aptitude', trainer: '', startDate: '', endDate: '', status: 'planned' });

  const { data, isLoading } = useQuery({ queryKey: ['placement-trainings', page], queryFn: () => listPlacementTrainings(page, 20) });

  const createMut = useMutation({ mutationFn: createPlacementTraining, onSuccess: () => { qc.invalidateQueries({ queryKey: ['placement-trainings'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updatePlacementTraining(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['placement-trainings'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deletePlacementTraining, onSuccess: () => { qc.invalidateQueries({ queryKey: ['placement-trainings'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ title: '', type: 'aptitude', trainer: '', startDate: '', endDate: '', status: 'planned' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      title: row.title || '', type: row.type || 'aptitude',
      trainer: row.trainer || '',
      startDate: row.startDate ? row.startDate.slice(0, 10) : '',
      endDate: row.endDate ? row.endDate.slice(0, 10) : '',
      status: row.status || 'planned',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.trainer) delete payload.trainer;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const statusVariant: Record<string, string> = { planned: 'default', ongoing: 'warning', completed: 'success' };

  const columns = [
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium text-navy">{r.title}</span> },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant="info">{r.type}</Badge> },
    { key: 'trainer', label: 'Trainer', render: (r: any) => r.trainer || '--' },
    { key: 'startDate', label: 'Start', render: (r: any) => r.startDate ? new Date(r.startDate).toLocaleDateString() : '--' },
    { key: 'endDate', label: 'End', render: (r: any) => r.endDate ? new Date(r.endDate).toLocaleDateString() : '--' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={statusVariant[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this training?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Placement Trainings</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Training</button>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Training' : 'New Training'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Title *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Type *</label>
              <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Trainer</label><input value={form.trainer} onChange={e => setForm(f => ({ ...f, trainer: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Start Date *</label><input required type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>End Date *</label><input required type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
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
