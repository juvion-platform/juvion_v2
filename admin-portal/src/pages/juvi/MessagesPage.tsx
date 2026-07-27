import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listMessages, createMessage, updateMessage, listConversations } from '../../services/juvi';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Pencil, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const ROLES = ['user', 'assistant', 'system', 'tool'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { conversationId: '', role: 'user' as string, content: '', intent: '', tokens: '' };

export default function MessagesPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['juvi-messages', page, limit, search], queryFn: () => listMessages(page, limit, undefined, search) });
  const { data: conversations } = useQuery({ queryKey: ['juvi-conversations-all'], queryFn: () => listConversations(1, 200) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      conversationId: row.conversationId?._id || row.conversationId || '',
      role: row.role || 'user',
      content: row.content || '',
      intent: row.intent || '',
      tokens: row.tokens != null ? String(row.tokens) : '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createMessage, onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-messages'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateMessage(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['juvi-messages'] }); vem.close(); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (form.tokens) payload.tokens = Number(form.tokens);
    else delete payload.tokens;
    if (!payload.intent) delete payload.intent;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const roleVariant: Record<string, string> = { user: 'info', assistant: 'success', system: 'warning', tool: 'default' };

  const columns = [
    { key: 'role', label: 'Role', render: (r: any) => <Badge variant={roleVariant[r.role] || 'default'}>{r.role}</Badge> },
    { key: 'content', label: 'Content', render: (r: any) => <span className="text-sm text-gray-700 truncate max-w-xs block">{(r.content || '').substring(0, 80)}{(r.content || '').length > 80 ? '...' : ''}</span> },
    { key: 'conversationId', label: 'Conversation', render: (r: any) => {
      const c = r.conversationId;
      return <span className="text-xs text-gray-500">{c?.personaType ? `${c.personaType} - ${c.status}` : (c?._id || c || '—')}</span>;
    }},
    { key: 'intent', label: 'Intent', render: (r: any) => r.intent || '—' },
    { key: 'tokens', label: 'Tokens', render: (r: any) => r.tokens ?? '—' },
    { key: 'createdAt', label: 'Created', render: (r: any) => r.createdAt ? new Date(r.createdAt).toLocaleString() : '—' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Messages</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search messages…" className="w-56" />
        <span className="text-xs text-slate-400">Read-only · Messages are recorded by Juvi as a conversation happens.</span>
      </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No messages match “${search}”.` : 'No messages yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Message')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Conversation * {!vem.isView && <Link to="/juvi/conversations" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.conversationId} onChange={e => setForm(f => ({ ...f, conversationId: e.target.value }))} className={inp}>
                  <option value="">Select conversation</option>
                  {(conversations?.items || []).map((c: any) => <option key={c._id} value={c._id}>{c.personaType + ' - ' + c.status}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Role *</label>
                <select required value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inp}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className={lbl}>Content *</label><textarea required rows={4} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Intent</label><input value={form.intent} onChange={e => setForm(f => ({ ...f, intent: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Tokens</label><input type="number" min={0} value={form.tokens} onChange={e => setForm(f => ({ ...f, tokens: e.target.value }))} className={inp} /></div>
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
