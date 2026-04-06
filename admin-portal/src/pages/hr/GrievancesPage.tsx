import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listGrievances, createGrievance, updateGrievance, deleteGrievance } from '../../services/hr';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const CATEGORIES = ['salary', 'workplace', 'harassment', 'facilities', 'policy', 'other'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const STATUSES = ['open', 'in_progress', 'resolved', 'closed', 'escalated'] as const;
const PRIORITY_COLOR: Record<string, string> = { low: 'default', medium: 'info', high: 'warning', critical: 'danger' };
const STATUS_COLOR: Record<string, string> = { open: 'default', in_progress: 'info', resolved: 'success', closed: 'default', escalated: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function GrievancesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    raisedBy: '', category: 'salary' as string, subject: '', description: '',
    priority: 'medium' as string, assignedTo: '', status: 'open' as string, resolution: '',
  });

  const { data, isLoading } = useQuery({ queryKey: ['grievances', page], queryFn: () => listGrievances(page, 20) });

  const createMut = useMutation({ mutationFn: createGrievance, onSuccess: () => { qc.invalidateQueries({ queryKey: ['grievances'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateGrievance(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['grievances'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteGrievance, onSuccess: () => { qc.invalidateQueries({ queryKey: ['grievances'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ raisedBy: '', category: 'salary', subject: '', description: '', priority: 'medium', assignedTo: '', status: 'open', resolution: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      raisedBy: row.raisedBy?._id || row.raisedBy || '',
      category: row.category || 'salary',
      subject: row.subject || '',
      description: row.description || '',
      priority: row.priority || 'medium',
      assignedTo: row.assignedTo?._id || row.assignedTo || '',
      status: row.status || 'open',
      resolution: row.resolution || '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!form.assignedTo) delete payload.assignedTo;
    if (!form.resolution) delete payload.resolution;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'subject', label: 'Subject', render: (r: any) => <span className="font-medium text-navy">{r.subject}</span> },
    { key: 'category', label: 'Category', render: (r: any) => <Badge variant="info">{r.category}</Badge> },
    { key: 'raisedBy', label: 'Raised By', render: (r: any) => <span>{r.raisedBy?.name || '\u2014'}</span> },
    { key: 'priority', label: 'Priority', render: (r: any) => <Badge variant={PRIORITY_COLOR[r.priority] || 'default'}>{r.priority}</Badge> },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this grievance?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Grievances</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Grievance
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Grievance' : 'New Grievance'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Raised By (Person ID) *</label>
              <input required value={form.raisedBy} onChange={e => setForm(f => ({ ...f, raisedBy: e.target.value }))} className={inp} placeholder="Person ID" />
            </div>
            <div><label className={lbl}>Category *</label>
              <select required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={lbl}>Subject *</label>
              <input required value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className={inp} />
            </div>
            <div className="col-span-2"><label className={lbl}>Description *</label>
              <input required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Priority *</label>
              <select required value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={inp}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Assigned To (Person ID)</label>
              <input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} className={inp} placeholder="Person ID" />
            </div>
            <div><label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Resolution</label>
              <input value={form.resolution} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))} className={inp} />
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
