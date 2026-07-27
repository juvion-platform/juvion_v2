import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listEmailLogs, createEmailLog, updateEmailLog } from '../../services/platform';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Pencil } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const STATUSES = ['queued', 'sent', 'delivered', 'opened', 'bounced', 'failed'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = { recipientEmail: '', recipientId: '', subject: '', body: '', status: 'queued' };

export default function EmailLogsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['email-logs', page, limit, search], queryFn: () => listEmailLogs(page, limit, undefined, search) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      recipientEmail: row.recipientEmail || '',
      recipientId: row.recipientId?._id || row.recipientId || '',
      subject: row.subject || '',
      body: row.body || '',
      status: row.status || 'queued',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createEmailLog, onSuccess: () => { qc.invalidateQueries({ queryKey: ['email-logs'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateEmailLog(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['email-logs'] }); vem.close(); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.recipientId) delete payload.recipientId;
    if (!payload.body) delete payload.body;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

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
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Email Logs</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search email logs…" className="w-56" />
        <span className="text-xs text-slate-400">Read-only · Email delivery logs are written by the notification pipeline.</span>
      </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No email logs match “${search}”.` : 'No email logs yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Email Log')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
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
