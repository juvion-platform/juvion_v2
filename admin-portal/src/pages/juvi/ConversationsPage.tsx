import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listConversations, createConversation, updateConversation, deleteConversation } from '../../services/juvi';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const STATUSES = ['active', 'closed', 'archived'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = { userId: '', personaType: '', status: 'active' as string, messageCount: '' };

export default function ConversationsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['juvi-conversations', page, limit, search], queryFn: () => listConversations(page, limit, search) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      userId: row.userId?._id || row.userId || '',
      personaType: row.personaType || '',
      status: row.status || 'active',
      messageCount: row.messageCount != null ? String(row.messageCount) : '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createConversation, onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-conversations'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateConversation(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-conversations'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteConversation, onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-conversations'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (form.messageCount) payload.messageCount = Number(form.messageCount);
    else delete payload.messageCount;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const statusVariant: Record<string, string> = { active: 'success', closed: 'default', archived: 'warning' };

  const columns = [
    { key: 'personaType', label: 'Persona', render: (r: any) => <span className="font-medium text-navy">{r.personaType}</span> },
    { key: 'userId', label: 'User ID', render: (r: any) => <span className="text-xs text-gray-500 font-mono">{r.userId?._id || r.userId || '—'}</span> },
    { key: 'messageCount', label: 'Messages', render: (r: any) => r.messageCount ?? 0 },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={statusVariant[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'lastMessageAt', label: 'Last Message', render: (r: any) => r.lastMessageAt ? new Date(r.lastMessageAt).toLocaleString() : '—' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this conversation?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Conversations</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search conversations…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Conversation
        </button>
      </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView} />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Conversation')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>User ID *</label><input required value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Persona Type *</label><input required value={form.personaType} onChange={e => setForm(f => ({ ...f, personaType: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Message Count</label><input type="number" min={0} value={form.messageCount} onChange={e => setForm(f => ({ ...f, messageCount: e.target.value }))} className={inp} /></div>
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
                {saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
