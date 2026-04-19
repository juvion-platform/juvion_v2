import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listUsageMetrics, createUsageMetric, updateUsageMetric, deleteUsageMetric } from '../../services/juvi';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function UsageMetricsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ date: '', personaType: '', totalConversations: '', totalMessages: '', totalTokens: '', avgResponseTime: '', satisfactionScore: '' });

  const { data, isLoading } = useQuery({ queryKey: ['juvi-usage-metrics', page], queryFn: () => listUsageMetrics(page, 20) });

  const createMut = useMutation({ mutationFn: createUsageMetric, onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-usage-metrics'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateUsageMetric(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-usage-metrics'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteUsageMetric, onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-usage-metrics'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ date: '', personaType: '', totalConversations: '', totalMessages: '', totalTokens: '', avgResponseTime: '', satisfactionScore: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      date: row.date ? new Date(row.date).toISOString().split('T')[0] ?? '' : '',
      personaType: row.personaType || '',
      totalConversations: row.totalConversations != null ? String(row.totalConversations) : '',
      totalMessages: row.totalMessages != null ? String(row.totalMessages) : '',
      totalTokens: row.totalTokens != null ? String(row.totalTokens) : '',
      avgResponseTime: row.avgResponseTime != null ? String(row.avgResponseTime) : '',
      satisfactionScore: row.satisfactionScore != null ? String(row.satisfactionScore) : '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { date: form.date, personaType: form.personaType };
    if (form.totalConversations) payload.totalConversations = Number(form.totalConversations);
    if (form.totalMessages) payload.totalMessages = Number(form.totalMessages);
    if (form.totalTokens) payload.totalTokens = Number(form.totalTokens);
    if (form.avgResponseTime) payload.avgResponseTime = Number(form.avgResponseTime);
    if (form.satisfactionScore) payload.satisfactionScore = Number(form.satisfactionScore);
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'date', label: 'Date', render: (r: any) => <span className="font-medium text-navy">{r.date ? new Date(r.date).toLocaleDateString() : '—'}</span> },
    { key: 'personaType', label: 'Persona', render: (r: any) => <Badge variant="info">{r.personaType}</Badge> },
    { key: 'totalConversations', label: 'Conversations', render: (r: any) => r.totalConversations ?? 0 },
    { key: 'totalMessages', label: 'Messages', render: (r: any) => r.totalMessages ?? 0 },
    { key: 'totalTokens', label: 'Tokens', render: (r: any) => (r.totalTokens ?? 0).toLocaleString() },
    { key: 'avgResponseTime', label: 'Avg Response (ms)', render: (r: any) => r.avgResponseTime != null ? r.avgResponseTime.toFixed(0) : '—' },
    { key: 'satisfactionScore', label: 'Satisfaction', render: (r: any) => r.satisfactionScore != null ? r.satisfactionScore.toFixed(2) : '—' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this metric?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Usage Metrics</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Metric
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Usage Metric' : 'New Usage Metric'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Date *</label><input required type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Persona Type *</label><input required value={form.personaType} onChange={e => setForm(f => ({ ...f, personaType: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Total Conversations</label><input type="number" min={0} value={form.totalConversations} onChange={e => setForm(f => ({ ...f, totalConversations: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Total Messages</label><input type="number" min={0} value={form.totalMessages} onChange={e => setForm(f => ({ ...f, totalMessages: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Total Tokens</label><input type="number" min={0} value={form.totalTokens} onChange={e => setForm(f => ({ ...f, totalTokens: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Avg Response Time (ms)</label><input type="number" min={0} value={form.avgResponseTime} onChange={e => setForm(f => ({ ...f, avgResponseTime: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Satisfaction Score</label><input type="number" min={0} step="0.01" value={form.satisfactionScore} onChange={e => setForm(f => ({ ...f, satisfactionScore: e.target.value }))} className={inp} /></div>
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
