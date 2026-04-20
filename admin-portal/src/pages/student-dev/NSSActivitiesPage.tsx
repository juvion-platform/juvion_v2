import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listNSSActivities, createNSSActivity, updateNSSActivity, deleteNSSActivity } from '../../services/student-dev';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const TYPES = ['camp', 'blood_donation', 'awareness', 'tree_plantation', 'cleanliness', 'community_service', 'other'] as const;
const STATUSES = ['planned', 'completed', 'cancelled'] as const;
const STATUS_COLOR: Record<string, string> = { planned: 'info', completed: 'success', cancelled: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { title: '', type: 'camp', date: '', venue: '', description: '', coordinatorId: '', participantCount: '', hours: '', status: 'planned' };

export default function NSSActivitiesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      title: row.title || '',
      type: row.type || 'camp',
      date: row.date ? row.date.slice(0, 10) : '',
      venue: row.venue || '',
      description: row.description || '',
      coordinatorId: row.coordinatorId?._id || row.coordinatorId || '',
      participantCount: row.participantCount != null ? String(row.participantCount) : '',
      hours: row.hours != null ? String(row.hours) : '',
      status: row.status || 'planned',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const { data, isLoading } = useQuery({ queryKey: ['sd-nss-activities', page], queryFn: () => listNSSActivities(page, 20) });
  const { data: persons } = useQuery({ queryKey: ['persons', 'all'], queryFn: () => listPersons(1, 200) });

  const createMut = useMutation({ mutationFn: createNSSActivity, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-nss-activities'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateNSSActivity(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-nss-activities'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteNSSActivity, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-nss-activities'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.venue) delete payload.venue;
    if (!payload.description) delete payload.description;
    if (!payload.coordinatorId) delete payload.coordinatorId;
    if (payload.participantCount) payload.participantCount = Number(payload.participantCount); else delete payload.participantCount;
    payload.hours = Number(payload.hours);
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const columns = [
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium text-navy">{r.title}</span> },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant="info">{r.type}</Badge> },
    { key: 'date', label: 'Date', render: (r: any) => fmtDate(r.date) },
    { key: 'venue', label: 'Venue', render: (r: any) => r.venue || '\u2014' },
    { key: 'hours', label: 'Hours', render: (r: any) => r.hours },
    { key: 'coordinatorId', label: 'Coordinator', render: (r: any) => r.coordinatorId?.name || '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={(STATUS_COLOR[r.status] || 'default') as any}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this activity?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">NSS Activities</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Activity
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('NSS Activity')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Title *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Type *</label>
                <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Date *</label><input required type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Venue</label><input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} rows={2} /></div>
              <div>
                <label className={lbl}>Coordinator {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.coordinatorId} onChange={e => setForm(f => ({ ...f, coordinatorId: e.target.value }))} className={inp}>
                  <option value="">Select person</option>
                  {(persons?.items || []).map((p: any) => (
                    <option key={p._id} value={p._id}>{p.name || p._id}</option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Participant Count</label><input type="number" value={form.participantCount} onChange={e => setForm(f => ({ ...f, participantCount: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Hours *</label><input required type="number" min="0" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} className={inp} /></div>
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
