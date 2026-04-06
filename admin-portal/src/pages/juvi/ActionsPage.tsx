import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listActions, createAction, updateAction, deleteAction, listConversations } from '../../services/juvi';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const ACTION_TYPES = ['query', 'create', 'update', 'delete', 'navigate', 'report'] as const;
const ACTION_STATUSES = ['pending', 'executed', 'failed', 'rolled_back'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function ActionsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ conversationId: '', actionType: 'query' as string, module: '', entity: '', operation: '', status: 'pending' as string });

  const { data, isLoading } = useQuery({ queryKey: ['juvi-actions', page], queryFn: () => listActions(page, 20) });
  const { data: conversations } = useQuery({ queryKey: ['juvi-conversations-all'], queryFn: () => listConversations(1, 200) });

  const createMut = useMutation({ mutationFn: createAction, onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-actions'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateAction(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-actions'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteAction, onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-actions'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ conversationId: '', actionType: 'query', module: '', entity: '', operation: '', status: 'pending' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      conversationId: row.conversationId?._id || row.conversationId || '',
      actionType: row.actionType || 'query',
      module: row.module || '',
      entity: row.entity || '',
      operation: row.operation || '',
      status: row.status || 'pending',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const statusVariant: Record<string, string> = { pending: 'warning', executed: 'success', failed: 'danger', rolled_back: 'default' };

  const columns = [
    { key: 'actionType', label: 'Type', render: (r: any) => <Badge variant="info">{r.actionType}</Badge> },
    { key: 'module', label: 'Module', render: (r: any) => <span className="font-medium text-navy">{r.module}</span> },
    { key: 'entity', label: 'Entity', render: (r: any) => r.entity || '—' },
    { key: 'operation', label: 'Operation', render: (r: any) => r.operation || '—' },
    { key: 'conversationId', label: 'Conversation', render: (r: any) => {
      const c = r.conversationId;
      return <span className="text-xs text-gray-500">{c?.personaType ? `${c.personaType} - ${c.status}` : (c?._id || c || '—')}</span>;
    }},
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={statusVariant[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'executedAt', label: 'Executed', render: (r: any) => r.executedAt ? new Date(r.executedAt).toLocaleString() : '—' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this action?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Actions</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Action
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Action' : 'New Action'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Conversation * <Link to="/juvi/conversations" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.conversationId} onChange={e => setForm(f => ({ ...f, conversationId: e.target.value }))} className={inp}>
                <option value="">Select conversation</option>
                {(conversations?.items || []).map((c: any) => <option key={c._id} value={c._id}>{c.personaType + ' - ' + c.status}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Action Type *</label>
              <select required value={form.actionType} onChange={e => setForm(f => ({ ...f, actionType: e.target.value }))} className={inp}>
                {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Module *</label><input required value={form.module} onChange={e => setForm(f => ({ ...f, module: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Entity *</label><input required value={form.entity} onChange={e => setForm(f => ({ ...f, entity: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Operation *</label><input required value={form.operation} onChange={e => setForm(f => ({ ...f, operation: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {ACTION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
