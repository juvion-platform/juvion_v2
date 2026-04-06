import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listWhatsAppLogs, createWhatsAppLog, updateWhatsAppLog, deleteWhatsAppLog } from '../../services/platform';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const STATUSES = ['queued', 'sent', 'delivered', 'read', 'failed'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function WhatsAppLogsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ recipientPhone: '', recipientId: '', templateName: '', message: '', mediaUrl: '', status: 'queued' });

  const { data, isLoading } = useQuery({ queryKey: ['whatsapp-logs', page], queryFn: () => listWhatsAppLogs(page, 20) });

  const createMut = useMutation({ mutationFn: createWhatsAppLog, onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp-logs'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateWhatsAppLog(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp-logs'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteWhatsAppLog, onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp-logs'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ recipientPhone: '', recipientId: '', templateName: '', message: '', mediaUrl: '', status: 'queued' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      recipientPhone: row.recipientPhone || '',
      recipientId: row.recipientId?._id || row.recipientId || '',
      templateName: row.templateName || '',
      message: row.message || '',
      mediaUrl: row.mediaUrl || '',
      status: row.status || 'queued',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.recipientId) delete payload.recipientId;
    if (!payload.templateName) delete payload.templateName;
    if (!payload.message) delete payload.message;
    if (!payload.mediaUrl) delete payload.mediaUrl;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { queued: 'default', sent: 'info', delivered: 'success', read: 'success', failed: 'danger' };
    return <Badge variant={(map[s] || 'default') as any}>{s}</Badge>;
  };

  const columns = [
    { key: 'recipientPhone', label: 'Phone', render: (r: any) => <span className="font-medium text-navy">{r.recipientPhone}</span> },
    { key: 'templateName', label: 'Template', render: (r: any) => r.templateName || '\u2014' },
    { key: 'message', label: 'Message', render: (r: any) => ((r.message || '').slice(0, 50) + ((r.message || '').length > 50 ? '...' : '')) || '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => statusBadge(r.status) },
    { key: 'sentAt', label: 'Sent', render: (r: any) => fmtDate(r.sentAt) },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this WhatsApp log?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">WhatsApp Logs</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New WhatsApp Log
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit WhatsApp Log' : 'New WhatsApp Log'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Recipient Phone *</label><input required value={form.recipientPhone} onChange={e => setForm(f => ({ ...f, recipientPhone: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Recipient ID</label><input value={form.recipientId} onChange={e => setForm(f => ({ ...f, recipientId: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Template Name</label><input value={form.templateName} onChange={e => setForm(f => ({ ...f, templateName: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Media URL</label><input value={form.mediaUrl} onChange={e => setForm(f => ({ ...f, mediaUrl: e.target.value }))} className={inp} /></div>
            <div className="col-span-2"><label className={lbl}>Message</label><textarea rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className={inp} /></div>
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
