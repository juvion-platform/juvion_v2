import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSMSLogs, createSMSLog, updateSMSLog, deleteSMSLog } from '../../services/platform';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const STATUSES = ['queued', 'sent', 'delivered', 'failed', 'bounced'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = { recipientPhone: '', recipientId: '', message: '', templateId: '', provider: '', status: 'queued', cost: '' };

export default function SMSLogsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['sms-logs', page, limit, search], queryFn: () => listSMSLogs(page, limit, undefined, search) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      recipientPhone: row.recipientPhone || '',
      recipientId: row.recipientId?._id || row.recipientId || '',
      message: row.message || '',
      templateId: row.templateId || '',
      provider: row.provider || '',
      status: row.status || 'queued',
      cost: row.cost != null ? String(row.cost) : '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createSMSLog, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sms-logs'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateSMSLog(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['sms-logs'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteSMSLog, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sms-logs'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.recipientId) delete payload.recipientId;
    if (!payload.templateId) delete payload.templateId;
    if (!payload.provider) delete payload.provider;
    if (payload.cost) payload.cost = Number(payload.cost);
    else delete payload.cost;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { queued: 'default', sent: 'info', delivered: 'success', failed: 'danger', bounced: 'warning' };
    return <Badge variant={(map[s] || 'default') as any}>{s}</Badge>;
  };

  const columns = [
    { key: 'recipientPhone', label: 'Phone', render: (r: any) => <span className="font-medium text-navy">{r.recipientPhone}</span> },
    { key: 'message', label: 'Message', render: (r: any) => (r.message || '').slice(0, 50) + ((r.message || '').length > 50 ? '...' : '') },
    { key: 'provider', label: 'Provider', render: (r: any) => r.provider || '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => statusBadge(r.status) },
    { key: 'sentAt', label: 'Sent', render: (r: any) => fmtDate(r.sentAt) },
    { key: 'cost', label: 'Cost', render: (r: any) => r.cost != null ? `${r.cost}` : '\u2014' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this SMS log?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">SMS Logs</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search sms logs…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New SMS Log
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('SMS Log')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Recipient Phone *</label><input required value={form.recipientPhone} onChange={e => setForm(f => ({ ...f, recipientPhone: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Recipient ID</label><input value={form.recipientId} onChange={e => setForm(f => ({ ...f, recipientId: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Message *</label><textarea required rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Template ID</label><input value={form.templateId} onChange={e => setForm(f => ({ ...f, templateId: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Provider</label><input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Cost</label><input type="number" step="0.01" min={0} value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} className={inp} /></div>
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
                {saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
