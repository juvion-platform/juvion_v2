import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPlacementBars, createPlacementBar, updatePlacementBar, deletePlacementBar } from '../../services/placement';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const BAR_TYPES = ['disciplinary', 'academic_fraud', 'fee_default', 'other'] as const;
const STATUSES = ['active', 'lifted'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function PlacementBarsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ studentId: '', barType: 'disciplinary', reason: '', status: 'active', liftConditions: '' });

  const { data, isLoading } = useQuery({ queryKey: ['placement-bars', page], queryFn: () => listPlacementBars(page, 20) });
  const { data: students } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 200) });

  const createMut = useMutation({ mutationFn: createPlacementBar, onSuccess: () => { qc.invalidateQueries({ queryKey: ['placement-bars'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updatePlacementBar(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['placement-bars'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deletePlacementBar, onSuccess: () => { qc.invalidateQueries({ queryKey: ['placement-bars'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ studentId: '', barType: 'disciplinary', reason: '', status: 'active', liftConditions: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      studentId: row.studentId?._id || row.studentId || '',
      barType: row.barType || 'disciplinary',
      reason: row.reason || '',
      status: row.status || 'active',
      liftConditions: row.liftConditions || '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      studentId: form.studentId,
      barType: form.barType,
      reason: form.reason,
      status: form.status,
    };
    if (form.liftConditions) payload.liftConditions = form.liftConditions;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const barTypeVariant: Record<string, string> = { disciplinary: 'danger', academic_fraud: 'danger', fee_default: 'warning', other: 'default' };
  const statusVariant: Record<string, string> = { active: 'danger', lifted: 'success' };

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.firstName ? `${r.studentId.firstName} ${r.studentId.lastName || ''}` : '--'}</span> },
    { key: 'barType', label: 'Bar Type', render: (r: any) => <Badge variant={barTypeVariant[r.barType] || 'default'}>{r.barType?.replace(/_/g, ' ')}</Badge> },
    { key: 'reason', label: 'Reason', render: (r: any) => <span className="truncate max-w-[200px] block">{r.reason || '--'}</span> },
    { key: 'appliedAt', label: 'Applied At', render: (r: any) => r.appliedAt ? new Date(r.appliedAt).toLocaleDateString() : '--' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={statusVariant[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'liftedAt', label: 'Lifted At', render: (r: any) => r.liftedAt ? new Date(r.liftedAt).toLocaleDateString() : '--' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this placement bar?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Placement Bars</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Placement Bar</button>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Placement Bar' : 'New Placement Bar'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Student *</label>
              <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                <option value="">Select student</option>
                {(students?.items || []).map((s: any) => <option key={s._id} value={s._id}>{s.firstName} {s.lastName || ''} ({s.rollNumber || s.registrationNumber || ''})</option>)}
              </select>
            </div>
            <div><label className={lbl}>Bar Type *</label>
              <select required value={form.barType} onChange={e => setForm(f => ({ ...f, barType: e.target.value }))} className={inp}>
                {BAR_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={lbl}>Reason *</label><textarea required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className={inp} rows={3} /></div>
            <div><label className={lbl}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Lift Conditions</label><input value={form.liftConditions} onChange={e => setForm(f => ({ ...f, liftConditions: e.target.value }))} className={inp} placeholder="Conditions for lifting the bar" /></div>
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
