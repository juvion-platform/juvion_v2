import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLeaveApplications, createLeaveApplication, updateLeaveApplication, deleteLeaveApplication, listEmployees, listLeaveTypes, approveLeaveApplication, rejectLeaveApplication, withdrawLeaveApplication } from '../../services/hr';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink, Check, X, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const STATUS_COLOR: Record<string, string> = { applied: 'default', approved: 'success', rejected: 'danger', cancelled: 'warning' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { employeeId: '', leaveTypeId: '', fromDate: '', toDate: '', days: '', reason: '', status: 'applied', remarks: '' };

export default function LeaveApplicationsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['leave-applications', page, limit, search], queryFn: () => listLeaveApplications(page, limit, undefined, undefined, search) });
  const { data: employeesData } = useQuery({ queryKey: ['employees-all'], queryFn: () => listEmployees(1, 200) });
  const { data: leaveTypesData } = useQuery({ queryKey: ['leave-types-all'], queryFn: () => listLeaveTypes(1, 100) });

  const employees = employeesData?.items || [];
  const leaveTypes = leaveTypesData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      employeeId: row.employeeId?._id || row.employeeId || '',
      leaveTypeId: row.leaveTypeId?._id || row.leaveTypeId || '',
      fromDate: row.fromDate ? row.fromDate.slice(0, 10) : '',
      toDate: row.toDate ? row.toDate.slice(0, 10) : '',
      days: row.days != null ? String(row.days) : '',
      reason: row.reason || '',
      status: row.status || 'applied',
      remarks: row.remarks || '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createLeaveApplication, onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-applications'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateLeaveApplication(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-applications'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteLeaveApplication, onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-applications'] }); } });

  // Inclusive day count derived from the date range, so a 12–14 Jan leave is
  // always 3 days rather than whatever the operator typed.
  const computedDays = (() => {
    if (!form.fromDate || !form.toDate) return 0;
    const from = new Date(form.fromDate);
    const to = new Date(form.toDate);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
    const diff = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    return diff > 0 ? diff : 0;
  })();
  const dateRangeInvalid = Boolean(form.fromDate && form.toDate && computedDays === 0);

  const workflowMut = useMutation({
    mutationFn: ({ id, action, remarks }: { id: string; action: 'approve' | 'reject' | 'withdraw'; remarks?: string }) => {
      if (action === 'approve') return approveLeaveApplication(id, { remarks });
      if (action === 'reject') return rejectLeaveApplication(id, { remarks });
      return withdrawLeaveApplication(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-applications'] });
      qc.invalidateQueries({ queryKey: ['leave-balances'] });
      vem.close();
    },
  });
  const workflowPending = workflowMut.isPending;

  async function handleDecision(action: 'approve' | 'reject' | 'withdraw') {
    if (!vem.entity) return;
    const label = action === 'approve' ? 'Approve' : action === 'reject' ? 'Reject' : 'Withdraw';
    const res = await confirmAction({
      title: `${label} this leave application?`,
      message: action === 'approve'
        ? `${computedDays} day(s) will be deducted from the employee's leave balance.`
        : action === 'reject'
          ? 'The employee will see the reason you give below.'
          : 'The application will be returned to the employee.',
      tone: action === 'reject' ? 'danger' : 'primary',
      confirmLabel: label,
      requireReason: action === 'reject',
      reasonLabel: 'Rejection reason',
    });
    if (!res.confirmed) return;
    workflowMut.mutate({ id: vem.entity._id, action, remarks: res.reason });
  }

  /** Row-level variant of handleDecision — no modal open, so it takes the row. */
  async function decideRow(row: any, action: 'approve' | 'reject') {
    const label = action === 'approve' ? 'Approve' : 'Reject';
    const who = row.employeeId?.personId?.name || row.employeeId?.employeeId || 'this employee';
    const res = await confirmAction({
      title: `${label} ${row.days ?? ''} day leave for ${who}?`,
      message: action === 'approve'
        ? 'The days will be deducted from their leave balance.'
        : 'The employee will see the reason you give below.',
      tone: action === 'reject' ? 'danger' : 'primary',
      confirmLabel: label,
      requireReason: action === 'reject',
      reasonLabel: 'Rejection reason',
    });
    if (!res.confirmed) return;
    workflowMut.mutate({ id: row._id, action, remarks: res.reason });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (dateRangeInvalid || computedDays <= 0) return;
    const payload: any = { ...form, days: computedDays };
    // `status` is owned by the approve/reject/withdraw endpoints.
    delete payload.status;
    if (!form.remarks) delete payload.remarks;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  function employeeDisplayName(emp: any): string {
    return emp.personId?.name || emp.employeeId || emp._id;
  }

  function formatDate(d: string | undefined): string {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString();
  }

  const columns = [
    { key: 'employeeId', label: 'Employee', render: (r: any) => <span className="font-medium text-navy">{r.employeeId?.personId?.name || r.employeeId?.employeeId || '\u2014'}</span> },
    { key: 'leaveTypeId', label: 'Leave Type', render: (r: any) => r.leaveTypeId?.name || '\u2014' },
    { key: 'fromDate', label: 'From', render: (r: any) => formatDate(r.fromDate) },
    { key: 'toDate', label: 'To', render: (r: any) => formatDate(r.toDate) },
    { key: 'days', label: 'Days' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', sortable: false, render: (r: any) => (
      <div className="flex gap-1">
        {/* Inline approve/reject so a manager can clear the queue without
            opening each application. */}
        {r.status === 'applied' && (
          <>
            <button onClick={(e) => { e.stopPropagation(); void decideRow(r, 'approve'); }} className="p-1 rounded hover:bg-teal-50" title="Approve"><Check size={15} className="text-teal-600" /></button>
            <button onClick={(e) => { e.stopPropagation(); void decideRow(r, 'reject'); }} className="p-1 rounded hover:bg-red-50" title="Reject"><X size={15} className="text-red-500" /></button>
          </>
        )}
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this leave application?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Leave Applications</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search leave applications…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Leave Application
        </button>
      </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
        emptyMessage={search ? `No leave applications match “${search}”.` : 'No leave applications yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Leave Application')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Employee * {!vem.isView && <Link to="/hr/employees" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={inp}>
                  <option value="">Select employee...</option>
                  {employees.map((emp: any) => <option key={emp._id} value={emp._id}>{employeeDisplayName(emp)}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Leave Type * {!vem.isView && <Link to="/hr/leave-types" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.leaveTypeId} onChange={e => setForm(f => ({ ...f, leaveTypeId: e.target.value }))} className={inp}>
                  <option value="">Select leave type...</option>
                  {leaveTypes.map((lt: any) => <option key={lt._id} value={lt._id}>{lt.name || lt.code}</option>)}
                </select>
              </div>
              <div><label className={lbl}>From Date *</label><input required type="date" value={form.fromDate} onChange={e => setForm(f => ({ ...f, fromDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>To Date *</label><input required type="date" value={form.toDate} onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))} className={inp} /></div>

              {/* Days are inclusive of both endpoints and derived from the
                  dates. Hand-entering them let a 3-day range be filed as 30. */}
              <div>
                <label className={lbl}>Days</label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  {dateRangeInvalid
                    ? <span className="text-red-600">To Date is before From Date</span>
                    : computedDays > 0
                      ? <span className="font-medium text-slate-800">{computedDays} {computedDays === 1 ? 'day' : 'days'}</span>
                      : <span className="text-slate-400">Pick both dates</span>}
                </div>
              </div>

              <div>
                <label className={lbl}>Status</label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <Badge variant={STATUS_COLOR[form.status] || 'default'}>{form.status}</Badge>
                </div>
                {/* Status is a workflow outcome, not a form field. The
                    approve/reject endpoints deduct balances and record the
                    approver — a raw PUT of `status` skipped all of that. */}
                <p className="mt-1 text-xs text-slate-400">Use the actions below to change status.</p>
              </div>
              <div className="col-span-2"><label className={lbl}>Reason *</label><input required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Remarks</label><input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className={inp} placeholder="Optional" /></div>
            </div>
          </fieldset>
          {/* Approval workflow. Previously a manager had no way to approve a
              leave from the UI at all — only a raw Status dropdown that
              bypassed the balance-deduction endpoints. */}
          {vem.isView && vem.entity && form.status === 'applied' && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Approval</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={workflowPending}
                  onClick={() => handleDecision('approve')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
                >
                  <Check size={14} /> Approve
                </button>
                <button
                  type="button"
                  disabled={workflowPending}
                  onClick={() => handleDecision('reject')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  <X size={14} /> Reject
                </button>
                <button
                  type="button"
                  disabled={workflowPending}
                  onClick={() => handleDecision('withdraw')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white disabled:opacity-50"
                >
                  <Undo2 size={14} /> Withdraw
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={vem.close} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
              {vem.isView ? 'Close' : 'Cancel'}
            </button>
            {vem.isView ? (
              <button type="button" onClick={vem.switchToEdit} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
                <Pencil size={14} /> Edit
              </button>
            ) : (
              <button type="submit" disabled={saving || dateRangeInvalid || computedDays <= 0} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
