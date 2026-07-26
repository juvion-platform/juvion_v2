import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPayments, createPayment, updatePayment, deletePayment } from '../../services/finance';
import { getStudent, listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import StudentFinanceReadinessCard from '../../components/StudentFinanceReadinessCard';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const PAYMENT_MODES = ['cash', 'cheque', 'dd', 'online', 'upi', 'neft', 'rtgs', 'card'] as const;
const STATUSES = ['success', 'pending', 'failed', 'reversed'] as const;
const STATUS_COLOR: Record<string, string> = { success: 'success', pending: 'warning', failed: 'danger', reversed: 'info' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { studentId: '', receiptNumber: '', amount: '', paymentMode: 'cash', transactionRef: '', paymentDate: '', status: 'pending', remarks: '' };

export default function PaymentsPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [studentFilter, setStudentFilter] = useState(searchParams.get('studentId') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [form, setForm] = useState(emptyForm);

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      studentId: row.studentId?._id || row.studentId || '',
      receiptNumber: row.receiptNumber || '',
      amount: String(row.amount || ''),
      paymentMode: row.paymentMode || 'cash',
      transactionRef: row.transactionRef || '',
      paymentDate: row.paymentDate ? row.paymentDate.slice(0, 10) : '',
      status: row.status || 'pending',
      remarks: row.remarks || '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['payments', page, studentFilter, statusFilter, limit, search],
    queryFn: () => listPayments(page, limit, studentFilter || undefined, statusFilter || undefined, search),
  });
  const { data: students } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 100) });
  const { data: selectedStudent, isFetching: studentReadinessLoading } = useQuery({
    queryKey: ['student-finance-readiness', form.studentId],
    queryFn: () => getStudent(form.studentId),
    enabled: vem.isOpen && Boolean(form.studentId),
  });

  const financeBlocked = useMemo(() => Boolean(form.studentId) && Boolean(selectedStudent) && !selectedStudent.feeResponsibleParentId, [form.studentId, selectedStudent]);
  const financeReadinessPending = Boolean(form.studentId) && studentReadinessLoading;

  function syncSearch(next: { studentId?: string; status?: string }) {
    const params = new URLSearchParams();
    if (next.studentId) params.set('studentId', next.studentId);
    if (next.status) params.set('status', next.status);
    setSearchParams(params, { replace: true });
  }

  const createMut = useMutation({ mutationFn: createPayment, onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updatePayment(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); vem.close(); } });
  const quickUpdateMut = useMutation({ mutationFn: ({ id, data }: any) => updatePayment(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); } });
  const deleteMut = useMutation({ mutationFn: deletePayment, onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, amount: Number(form.amount) };
    if (!vem.isEdit) delete payload.receiptNumber;
    if (!payload.transactionRef) delete payload.transactionRef;
    if (!payload.remarks) delete payload.remarks;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  function quickTransition(row: any, nextStatus: string) {
    quickUpdateMut.mutate({ id: row._id, data: { status: nextStatus } });
  }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.personId?.name || r.studentId?.rollNumber || '—'}</span> },
    { key: 'receiptNumber', label: 'Receipt #' },
    { key: 'amount', label: 'Amount', render: (r: any) => `₹${Number(r.amount).toLocaleString()}` },
    { key: 'paymentMode', label: 'Mode', render: (r: any) => <Badge variant="info">{r.paymentMode}</Badge> },
    { key: 'paymentDate', label: 'Date', render: (r: any) => r.paymentDate ? new Date(r.paymentDate).toLocaleDateString() : '-' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex flex-wrap justify-end gap-1">
        {r.status === 'pending' && (
          <>
            <button onClick={(e) => { e.stopPropagation(); quickTransition(r, 'success'); }} disabled={quickUpdateMut.isPending} className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
              Mark success
            </button>
            <button onClick={(e) => { e.stopPropagation(); quickTransition(r, 'failed'); }} disabled={quickUpdateMut.isPending} className="rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50">
              Mark failed
            </button>
          </>
        )}
        {r.status === 'success' && (
          <button onClick={(e) => { e.stopPropagation(); quickTransition(r, 'reversed'); }} disabled={quickUpdateMut.isPending} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50">
            Reverse
          </button>
        )}
        {r.status === 'failed' && (
          <button onClick={(e) => { e.stopPropagation(); quickTransition(r, 'pending'); }} disabled={quickUpdateMut.isPending} className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50">
            Retry
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this payment?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Payments</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search payments…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Payment
        </button>
      </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <select value={studentFilter} onChange={(e) => {
          const value = e.target.value;
          setStudentFilter(value);
          setPage(1);
          syncSearch({ studentId: value, status: statusFilter });
        }} className={inp}>
          <option value="">All Students</option>
          {(students?.items || []).map((s: any) => (
            <option key={s._id} value={s._id}>
              {s.person?.name || s.rollNumber || s._id}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => {
          const value = e.target.value;
          setStatusFilter(value);
          setPage(1);
          syncSearch({ studentId: studentFilter, status: value });
        }} className={inp}>
          <option value="">All Statuses</option>
          {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Payment')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {form.studentId && (
            <StudentFinanceReadinessCard student={selectedStudent} loading={financeReadinessPending} />
          )}

          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Student * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student</option>
                  {(students?.items || []).map((s: any) => (
                    <option key={s._id} value={s._id}>
                      {s.person?.name || s.rollNumber || s._id}
                    </option>
                  ))}
                </select>
              </div>
              {vem.isEdit || vem.isView ? (
                <div>
                  <label className={lbl}>Receipt Number *</label>
                  <input required value={form.receiptNumber} onChange={e => setForm(f => ({ ...f, receiptNumber: e.target.value }))} className={inp} />
                </div>
              ) : (
                <div>
                  <label className={lbl}>Receipt Number</label>
                  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                    Auto-generated when the payment is saved
                  </div>
                </div>
              )}
              <div><label className={lbl}>Amount *</label><input required type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Payment Mode *</label>
                <select required value={form.paymentMode} onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))} className={inp}>
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Transaction Ref</label><input value={form.transactionRef} onChange={e => setForm(f => ({ ...f, transactionRef: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Payment Date *</label><input required type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Remarks</label><input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className={inp} /></div>
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
