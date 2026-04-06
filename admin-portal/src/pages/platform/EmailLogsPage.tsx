import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listEmailLogs, createEmailLog, updateEmailLog, deleteEmailLog } from '../../services/platform';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const STATUSES = ['queued', 'sent', 'delivered', 'opened', 'bounced', 'failed'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function EmailLogsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ recipientEmail: '', recipientId: '', subject: '', body: '', status: 'queued' });

  const { data, isLoading } = useQuery({ queryKey: ['email-logs', page], queryFn: () => listEmailLogs(page, 20) });

  const createMut = useMutation({ mutationFn: createEmailLog, onSuccess: () => { qc.invalidateQueries({ queryKey: ['email-logs'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateEmailLog(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['email-logs'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteEmailLog, onSuccess: () => { qc.invalidateQueries({ queryKey: ['email-logs'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ recipientEmail: '', recipientId: '', subject: '', body: '', status: 'queued' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      recipientEmail: row.recipientEmail || '',
      recipientId: row.recipientId?._id || row.recipientId || '',
      subject: row.subject || '',
      body: row.body || '',
      status: row.status || 'queued',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.recipientId) delete payload.recipientId;
    if (!payload.body) delete payload.body;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { queued: 'default', sent: 'info', delivered: 'success', opened: 'success', bounced: 'warning', failed: 'danger' };
    return <Badge variant={(map[s] || 'default') as any}>{s}</Badge>;
  };

  const columns = [
    { key: 'recipientEmail', label: 'Recipient', render: (r: any) => <span className="font-medium text-navy">{r.recipientEmail}</span> },
    { key: 'subject', label: 'Subject', render: (r: any) => r.subject },
    { key: 'status', label: 'Status', render: (r: any) => statusBadge(r.status) },
    { key: 'sentAt', label: 'Sent', render: (r: any) => fmtDate(r.sentAt) },
    { key: 'openedAt', label: 'Opened', render: (r: any) => fmtDate(r.openedAt) },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this email log?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Email Logs</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Email Log
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Email Log' : 'New Email Log'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Recipient Email *</label><input required type="email" value={form.recipientEmail} onChange={e => setForm(f => ({ ...f, recipientEmail: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Recipient ID</label><input value={form.recipientId} onChange={e => setForm(f => ({ ...f, recipientId: e.target.value }))} className={inp} /></div>
            <div className="col-span-2"><label className={lbl}>Subject *</label><input required value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className={inp} /></div>
            <div className="col-span-2"><label className={lbl}>Body</label><textarea rows={3} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} className={inp} /></div>
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
