import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAlumniEvents, createAlumniEvent, updateAlumniEvent, deleteAlumniEvent } from '../../services/placement';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const EVENT_TYPES = ['reunion', 'talk', 'mentoring', 'networking'] as const;
const STATUSES = ['planned', 'ongoing', 'completed'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function AlumniEventsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: '', eventType: 'reunion', date: '', venue: '', description: '', organizerId: '', status: 'planned' });

  const { data, isLoading } = useQuery({ queryKey: ['alumni-events', page], queryFn: () => listAlumniEvents(page, 20) });
  const { data: persons } = useQuery({ queryKey: ['persons-all'], queryFn: () => listPersons(1, 200) });

  const createMut = useMutation({ mutationFn: createAlumniEvent, onSuccess: () => { qc.invalidateQueries({ queryKey: ['alumni-events'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateAlumniEvent(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['alumni-events'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteAlumniEvent, onSuccess: () => { qc.invalidateQueries({ queryKey: ['alumni-events'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ title: '', eventType: 'reunion', date: '', venue: '', description: '', organizerId: '', status: 'planned' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      title: row.title || '', eventType: row.eventType || 'reunion',
      date: row.date ? row.date.slice(0, 10) : '',
      venue: row.venue || '', description: row.description || '',
      organizerId: row.organizerId?._id || row.organizerId || '',
      status: row.status || 'planned',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.venue) delete payload.venue;
    if (!payload.description) delete payload.description;
    if (!payload.organizerId) delete payload.organizerId;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const statusVariant: Record<string, string> = { planned: 'default', ongoing: 'warning', completed: 'success' };

  const columns = [
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium text-navy">{r.title}</span> },
    { key: 'eventType', label: 'Type', render: (r: any) => <Badge variant="info">{r.eventType}</Badge> },
    { key: 'date', label: 'Date', render: (r: any) => r.date ? new Date(r.date).toLocaleDateString() : '--' },
    { key: 'venue', label: 'Venue', render: (r: any) => r.venue || '--' },
    { key: 'organizerId', label: 'Organizer', render: (r: any) => r.organizerId?.name || '--' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={statusVariant[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this event?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Alumni Events</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Event</button>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Event' : 'New Event'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Title *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Event Type *</label>
              <select required value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))} className={inp}>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Date *</label><input required type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Venue</label><input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Organizer <Link to="/people/persons" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select value={form.organizerId} onChange={e => setForm(f => ({ ...f, organizerId: e.target.value }))} className={inp}>
                <option value="">Select organizer (optional)</option>
                {(persons?.items || []).map((p: any) => <option key={p._id} value={p._id}>{p.name || p._id}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={lbl}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} rows={3} /></div>
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
