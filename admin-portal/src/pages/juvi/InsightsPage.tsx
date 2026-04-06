import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listInsights, createInsight, updateInsight, deleteInsight } from '../../services/juvi';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const TYPES = ['anomaly', 'trend', 'prediction', 'recommendation', 'alert'] as const;
const SEVERITIES = ['info', 'warning', 'critical'] as const;
const STATUSES = ['new', 'seen', 'acted_upon', 'dismissed', 'expired'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function InsightsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ type: 'recommendation' as string, module: '', title: '', description: '', severity: 'info' as string, targetPersonas: '', isActionable: false, actionSuggestion: '', status: 'new' as string });

  const { data, isLoading } = useQuery({ queryKey: ['juvi-insights', page], queryFn: () => listInsights(page, 20) });

  const createMut = useMutation({ mutationFn: createInsight, onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-insights'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateInsight(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-insights'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteInsight, onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-insights'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ type: 'recommendation', module: '', title: '', description: '', severity: 'info', targetPersonas: '', isActionable: false, actionSuggestion: '', status: 'new' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      type: row.type || 'recommendation',
      module: row.module || '',
      title: row.title || '',
      description: row.description || '',
      severity: row.severity || 'info',
      targetPersonas: (row.targetPersonas || []).join(', '),
      isActionable: row.isActionable ?? false,
      actionSuggestion: row.actionSuggestion || '',
      status: row.status || 'new',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    payload.targetPersonas = form.targetPersonas ? form.targetPersonas.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (!payload.description) delete payload.description;
    if (!payload.actionSuggestion) delete payload.actionSuggestion;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const severityVariant: Record<string, string> = { info: 'info', warning: 'warning', critical: 'danger' };
  const statusVariant: Record<string, string> = { new: 'info', seen: 'default', acted_upon: 'success', dismissed: 'warning', expired: 'default' };

  const columns = [
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium text-navy">{r.title}</span> },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant="info">{r.type}</Badge> },
    { key: 'module', label: 'Module', render: (r: any) => r.module || '—' },
    { key: 'severity', label: 'Severity', render: (r: any) => <Badge variant={severityVariant[r.severity] || 'default'}>{r.severity}</Badge> },
    { key: 'isActionable', label: 'Actionable', render: (r: any) => r.isActionable ? 'Yes' : 'No' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={statusVariant[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'generatedAt', label: 'Generated', render: (r: any) => r.generatedAt ? new Date(r.generatedAt).toLocaleString() : '—' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this insight?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Insights</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Insight
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Insight' : 'New Insight'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Title *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Type *</label>
              <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Module *</label><input required value={form.module} onChange={e => setForm(f => ({ ...f, module: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Severity</label>
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className={inp}>
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={lbl}>Description</label><textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Target Personas (comma-separated)</label><input value={form.targetPersonas} onChange={e => setForm(f => ({ ...f, targetPersonas: e.target.value }))} className={inp} placeholder="admin, faculty" /></div>
            <div><label className={lbl}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="insightActionable" checked={form.isActionable} onChange={e => setForm(f => ({ ...f, isActionable: e.target.checked }))} className="rounded" />
              <label htmlFor="insightActionable" className="text-sm text-gray-700">Actionable</label>
            </div>
            <div><label className={lbl}>Action Suggestion</label><input value={form.actionSuggestion} onChange={e => setForm(f => ({ ...f, actionSuggestion: e.target.value }))} className={inp} /></div>
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
