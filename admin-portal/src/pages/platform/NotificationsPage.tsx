import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listNotifications, createNotification, updateNotification, deleteNotification } from '../../services/platform';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const TYPES = ['info', 'alert', 'reminder', 'emergency', 'announcement'] as const;
const AUDIENCES = ['all', 'students', 'faculty', 'staff', 'parents', 'department', 'section', 'individual'] as const;
const CHANNELS = ['app', 'sms', 'email', 'whatsapp', 'push'] as const;
const STATUSES = ['draft', 'scheduled', 'sent', 'failed'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: '', message: '', type: 'info', targetAudience: 'all', channel: 'app', sentBy: '', scheduledAt: '', status: 'draft' });

  const { data, isLoading } = useQuery({ queryKey: ['notifications', page], queryFn: () => listNotifications(page, 20) });

  const createMut = useMutation({ mutationFn: createNotification, onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateNotification(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteNotification, onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ title: '', message: '', type: 'info', targetAudience: 'all', channel: 'app', sentBy: '', scheduledAt: '', status: 'draft' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      title: row.title || '',
      message: row.message || '',
      type: row.type || 'info',
      targetAudience: row.targetAudience || 'all',
      channel: row.channel || 'app',
      sentBy: row.sentBy?._id || row.sentBy || '',
      scheduledAt: row.scheduledAt ? row.scheduledAt.slice(0, 16) : '',
      status: row.status || 'draft',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.scheduledAt) delete payload.scheduledAt;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { draft: 'default', scheduled: 'warning', sent: 'success', failed: 'danger' };
    return <Badge variant={(map[s] || 'default') as any}>{s}</Badge>;
  };

  const columns = [
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium text-navy">{r.title}</span> },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant="info">{r.type}</Badge> },
    { key: 'channel', label: 'Channel', render: (r: any) => r.channel },
    { key: 'targetAudience', label: 'Audience', render: (r: any) => r.targetAudience },
    { key: 'status', label: 'Status', render: (r: any) => statusBadge(r.status) },
    { key: 'createdAt', label: 'Created', render: (r: any) => fmtDate(r.createdAt) },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this notification?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Notifications</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Notification
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Notification' : 'New Notification'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className={lbl}>Title *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} /></div>
            <div className="col-span-2"><label className={lbl}>Message *</label><textarea required rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Type *</label>
              <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Target Audience *</label>
              <select required value={form.targetAudience} onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))} className={inp}>
                {AUDIENCES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Channel *</label>
              <select required value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} className={inp}>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Sent By (Person ID) *</label><input required value={form.sentBy} onChange={e => setForm(f => ({ ...f, sentBy: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Schedule At</label><input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} className={inp} /></div>
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
