import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listEvents, createEvent, updateEvent, deleteEvent, listClubs } from '../../services/student-dev';
import { listPersons } from '../../services/people';
import { listDepartments } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const TYPES = ['technical', 'cultural', 'sports', 'workshop', 'hackathon', 'fest', 'seminar', 'guest_lecture'] as const;
const STATUSES = ['planned', 'approved', 'ongoing', 'completed', 'cancelled'] as const;
const STATUS_COLOR: Record<string, string> = { planned: 'default', approved: 'info', ongoing: 'warning', completed: 'success', cancelled: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { name: '', type: 'technical', clubId: '', departmentId: '', description: '', startDate: '', endDate: '', venue: '', budget: '', coordinatorId: '', status: 'planned' };

export default function EventsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      name: row.name || '',
      type: row.type || 'technical',
      clubId: row.clubId?._id || row.clubId || '',
      departmentId: row.departmentId?._id || row.departmentId || '',
      description: row.description || '',
      startDate: row.startDate ? row.startDate.slice(0, 10) : '',
      endDate: row.endDate ? row.endDate.slice(0, 10) : '',
      venue: row.venue || '',
      budget: row.budget != null ? String(row.budget) : '',
      coordinatorId: row.coordinatorId?._id || row.coordinatorId || '',
      status: row.status || 'planned',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const { data, isLoading } = useQuery({ queryKey: ['sd-events', page], queryFn: () => listEvents(page, 20) });
  const { data: clubs } = useQuery({ queryKey: ['sd-clubs', 'all'], queryFn: () => listClubs(1, 200) });
  const { data: departments } = useQuery({ queryKey: ['departments', 'all'], queryFn: () => listDepartments(1, 100) });
  const { data: persons } = useQuery({ queryKey: ['persons', 'all'], queryFn: () => listPersons(1, 200) });

  const createMut = useMutation({ mutationFn: createEvent, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-events'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateEvent(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-events'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteEvent, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-events'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.clubId) delete payload.clubId;
    if (!payload.departmentId) delete payload.departmentId;
    if (!payload.description) delete payload.description;
    if (!payload.venue) delete payload.venue;
    if (!payload.coordinatorId) delete payload.coordinatorId;
    if (payload.budget) payload.budget = Number(payload.budget); else delete payload.budget;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant="info">{r.type}</Badge> },
    { key: 'clubId', label: 'Club', render: (r: any) => r.clubId?.name || '\u2014' },
    { key: 'startDate', label: 'Start', render: (r: any) => fmtDate(r.startDate) },
    { key: 'endDate', label: 'End', render: (r: any) => fmtDate(r.endDate) },
    { key: 'venue', label: 'Venue', render: (r: any) => r.venue || '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={(STATUS_COLOR[r.status] || 'default') as any}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this event?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Events</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Event
        </button>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView} />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Event')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Type *</label>
                <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Club {!vem.isView && <Link to="/student-dev/clubs" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.clubId} onChange={e => setForm(f => ({ ...f, clubId: e.target.value }))} className={inp}>
                  <option value="">Select club</option>
                  {(clubs?.items || []).map((c: any) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Department {!vem.isView && <Link to="/academics" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} className={inp}>
                  <option value="">Select department</option>
                  {(departments?.items || []).map((d: any) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2"><label className={lbl}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} rows={2} /></div>
              <div><label className={lbl}>Start Date *</label><input required type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>End Date *</label><input required type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Venue</label><input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Budget</label><input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} className={inp} /></div>
              <div>
                <label className={lbl}>Coordinator {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.coordinatorId} onChange={e => setForm(f => ({ ...f, coordinatorId: e.target.value }))} className={inp}>
                  <option value="">Select person</option>
                  {(persons?.items || []).map((p: any) => (
                    <option key={p._id} value={p._id}>{p.name || p._id}</option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </fieldset>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={vem.close} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
              {vem.isView ? 'Close' : 'Cancel'}
            </button>
            {vem.isView ? (
              <button type="button" onClick={vem.switchToEdit} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
                <Pencil size={14} /> Edit
              </button>
            ) : (
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Saving\u2026' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
