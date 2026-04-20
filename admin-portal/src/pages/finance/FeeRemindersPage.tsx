import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFeeReminder, deleteFeeReminder, listFeeLineItems, listFeeReminders, updateFeeReminder } from '../../services/finance';
import { getStudent, listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import StudentFinanceReadinessCard from '../../components/StudentFinanceReadinessCard';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const CHANNELS = ['sms', 'email', 'whatsapp', 'app'] as const;
const STATUSES = ['sent', 'delivered', 'failed'] as const;
const STATUS_COLOR: Record<string, string> = { sent: 'info', delivered: 'success', failed: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = {
  studentId: '',
  lineItemId: '',
  channel: 'sms',
  dueAmount: '',
  status: 'sent',
};

export default function FeeRemindersPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [studentFilter, setStudentFilter] = useState(searchParams.get('studentId') || '');
  const [channelFilter, setChannelFilter] = useState(searchParams.get('channel') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [form, setForm] = useState(emptyForm);

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      studentId: row.studentId?._id || row.studentId || '',
      lineItemId: row.lineItemId?._id || row.lineItemId || '',
      channel: row.channel || 'sms',
      dueAmount: row.dueAmount != null ? String(row.dueAmount) : '',
      status: row.status || 'sent',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['fee-reminders', page, studentFilter, channelFilter, statusFilter],
    queryFn: () => listFeeReminders(page, 20, studentFilter || undefined, channelFilter || undefined, statusFilter || undefined),
  });
  const { data: studentsData } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 100) });
  const { data: lineItemsData } = useQuery({ queryKey: ['fee-line-items-all'], queryFn: () => listFeeLineItems(1, 100) });
  const { data: selectedStudent, isFetching: studentReadinessLoading } = useQuery({
    queryKey: ['student-finance-readiness', form.studentId],
    queryFn: () => getStudent(form.studentId),
    enabled: vem.isOpen && Boolean(form.studentId),
  });

  const students = studentsData?.items || [];
  const lineItems = lineItemsData?.items || [];
  const financeBlocked = useMemo(() => Boolean(form.studentId) && Boolean(selectedStudent) && !selectedStudent.feeResponsibleParentId, [form.studentId, selectedStudent]);
  const financeReadinessPending = Boolean(form.studentId) && studentReadinessLoading;

  function syncSearch(next: { studentId?: string; channel?: string; status?: string }) {
    const params = new URLSearchParams();
    if (next.studentId) params.set('studentId', next.studentId);
    if (next.channel) params.set('channel', next.channel);
    if (next.status) params.set('status', next.status);
    setSearchParams(params, { replace: true });
  }

  const createMut = useMutation({ mutationFn: createFeeReminder, onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-reminders'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateFeeReminder(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-reminders'] }); vem.close(); } });
  const quickUpdateMut = useMutation({ mutationFn: ({ id, data }: any) => updateFeeReminder(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-reminders'] }); } });
  const deleteMut = useMutation({ mutationFn: deleteFeeReminder, onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-reminders'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      studentId: form.studentId,
      channel: form.channel,
      dueAmount: Number(form.dueAmount),
      status: form.status,
    };
    if (form.lineItemId) payload.lineItemId = form.lineItemId;

    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  function quickTransition(row: any, nextStatus: string) {
    quickUpdateMut.mutate({ id: row._id, data: { status: nextStatus } });
  }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.personId?.name || r.studentId?.rollNumber || '—'}</span> },
    { key: 'channel', label: 'Channel', render: (r: any) => <Badge variant="info">{r.channel}</Badge> },
    { key: 'dueAmount', label: 'Due Amount', render: (r: any) => `₹${Number(r.dueAmount || 0).toLocaleString()}` },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex flex-wrap gap-1 justify-end">
        {r.status === 'sent' && (
          <>
            <button onClick={(e) => { e.stopPropagation(); quickTransition(r, 'delivered'); }} disabled={quickUpdateMut.isPending} className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
              Delivered
            </button>
            <button onClick={(e) => { e.stopPropagation(); quickTransition(r, 'failed'); }} disabled={quickUpdateMut.isPending} className="rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50">
              Failed
            </button>
          </>
        )}
        {r.status === 'failed' && (
          <button onClick={(e) => { e.stopPropagation(); quickTransition(r, 'sent'); }} disabled={quickUpdateMut.isPending} className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50">
            Retry
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this reminder?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Fee Reminders</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Reminder
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <select value={studentFilter} onChange={(e) => {
          const value = e.target.value;
          setStudentFilter(value);
          setPage(1);
          syncSearch({ studentId: value, channel: channelFilter, status: statusFilter });
        }} className={inp}>
          <option value="">All Students</option>
          {students.map((item: any) => <option key={item._id} value={item._id}>{item.person?.name || item.rollNumber || item._id}</option>)}
        </select>
        <select value={channelFilter} onChange={(e) => {
          const value = e.target.value;
          setChannelFilter(value);
          setPage(1);
          syncSearch({ studentId: studentFilter, channel: value, status: statusFilter });
        }} className={inp}>
          <option value="">All Channels</option>
          {CHANNELS.map((channel) => <option key={channel} value={channel}>{channel}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => {
          const value = e.target.value;
          setStatusFilter(value);
          setPage(1);
          syncSearch({ studentId: studentFilter, channel: channelFilter, status: value });
        }} className={inp}>
          <option value="">All Statuses</option>
          {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </div>

      <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
        Fee reminders are outbound nudges for dues collection. Link them to a fee line item when possible so follow-up stays tied to a concrete payable charge.
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
        emptyState={
          <div className="space-y-2">
            <div className="font-medium text-slate-600">No fee reminders yet</div>
            <div className="text-sm text-gray-400">Create a reminder when a student has an upcoming or overdue amount and needs outreach through SMS, email, WhatsApp, or the app.</div>
          </div>
        }
      />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Fee Reminder')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {form.studentId && (
            <StudentFinanceReadinessCard student={selectedStudent} loading={financeReadinessPending} />
          )}

          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Student * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student</option>
                  {students.map((item: any) => <option key={item._id} value={item._id}>{item.person?.name || item.rollNumber || item._id}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Fee Line Item {!vem.isView && <Link to="/finance/fee-line-items" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.lineItemId} onChange={(e) => setForm((f) => ({ ...f, lineItemId: e.target.value }))} className={inp}>
                  <option value="">None</option>
                  {lineItems.map((item: any) => (
                    <option key={item._id} value={item._id}>
                      {(item.studentId?.personId?.name || item.studentId?.rollNumber || 'Student')} - {item.component}
                    </option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Channel *</label>
                <select required value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))} className={inp}>
                  {CHANNELS.map((channel) => <option key={channel} value={channel}>{channel}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Due Amount *</label><input required type="number" min={0} value={form.dueAmount} onChange={(e) => setForm((f) => ({ ...f, dueAmount: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
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
              <button type="submit" disabled={saving || (!vem.isEdit && (financeBlocked || financeReadinessPending))} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Saving…' : financeReadinessPending ? 'Checking student...' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
