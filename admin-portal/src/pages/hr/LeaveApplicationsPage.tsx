import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLeaveApplications, createLeaveApplication, updateLeaveApplication, deleteLeaveApplication, listEmployees, listLeaveTypes } from '../../services/hr';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const STATUSES = ['applied', 'approved', 'rejected', 'cancelled'] as const;
const STATUS_COLOR: Record<string, string> = { applied: 'default', approved: 'success', rejected: 'danger', cancelled: 'warning' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { employeeId: '', leaveTypeId: '', fromDate: '', toDate: '', days: '', reason: '', status: 'applied', remarks: '' };

export default function LeaveApplicationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['leave-applications', page], queryFn: () => listLeaveApplications(page, 20) });
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (form.days) payload.days = Number(form.days);
    else delete payload.days;
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
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this leave application?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Leave Applications</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Leave Application
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
      />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

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
              <div><label className={lbl}>Days *</label><input required type="number" min={0} value={form.days} onChange={e => setForm(f => ({ ...f, days: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className={lbl}>Reason *</label><input required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Remarks</label><input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className={inp} placeholder="Optional" /></div>
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
