import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listFeedback, createFeedback, updateFeedback, deleteFeedback, listMessages } from '../../services/juvi';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function FeedbackPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ messageId: '', userId: '', rating: '1', feedback: '' });

  const { data, isLoading } = useQuery({ queryKey: ['juvi-feedback', page], queryFn: () => listFeedback(page, 20) });
  const { data: messages } = useQuery({ queryKey: ['juvi-messages-all'], queryFn: () => listMessages(1, 200) });

  const createMut = useMutation({ mutationFn: createFeedback, onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-feedback'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateFeedback(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-feedback'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteFeedback, onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-feedback'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ messageId: '', userId: '', rating: '1', feedback: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      messageId: row.messageId?._id || row.messageId || '',
      userId: row.userId?._id || row.userId || '',
      rating: String(row.rating ?? 1),
      feedback: row.feedback || '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, rating: Number(form.rating) };
    if (!payload.feedback) delete payload.feedback;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  function ratingVariant(rating: number) {
    if (rating > 0) return 'success';
    if (rating < 0) return 'danger';
    return 'default';
  }
  function ratingLabel(rating: number) {
    if (rating > 0) return 'Positive';
    if (rating < 0) return 'Negative';
    return 'Neutral';
  }

  const columns = [
    { key: 'messageId', label: 'Message', render: (r: any) => {
      const m = r.messageId;
      const content = m?.content || '';
      return <span className="text-sm text-gray-700">{content.substring(0, 50)}{content.length > 50 ? '...' : ''}{!content && (m?._id || m || '—')}</span>;
    }},
    { key: 'userId', label: 'User ID', render: (r: any) => <span className="text-xs text-gray-500 font-mono">{r.userId?._id || r.userId || '—'}</span> },
    { key: 'rating', label: 'Rating', render: (r: any) => <Badge variant={ratingVariant(r.rating)}>{ratingLabel(r.rating)} ({r.rating})</Badge> },
    { key: 'feedback', label: 'Feedback', render: (r: any) => <span className="text-sm text-gray-600">{(r.feedback || '—').substring(0, 60)}{(r.feedback || '').length > 60 ? '...' : ''}</span> },
    { key: 'createdAt', label: 'Created', render: (r: any) => r.createdAt ? new Date(r.createdAt).toLocaleString() : '—' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this feedback?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Feedback</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Feedback
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Feedback' : 'New Feedback'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Message * <Link to="/juvi/messages" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.messageId} onChange={e => setForm(f => ({ ...f, messageId: e.target.value }))} className={inp}>
                <option value="">Select message</option>
                {(messages?.items || []).map((m: any) => <option key={m._id} value={m._id}>{(m.content || '').substring(0, 60)}{(m.content || '').length > 60 ? '...' : ''}</option>)}
              </select>
            </div>
            <div><label className={lbl}>User ID *</label><input required value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Rating * (-1 to 1)</label>
              <select required value={form.rating} onChange={e => setForm(f => ({ ...f, rating: e.target.value }))} className={inp}>
                <option value="1">1 (Positive)</option>
                <option value="0">0 (Neutral)</option>
                <option value="-1">-1 (Negative)</option>
              </select>
            </div>
            <div><label className={lbl}>Feedback</label><input value={form.feedback} onChange={e => setForm(f => ({ ...f, feedback: e.target.value }))} className={inp} /></div>
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
