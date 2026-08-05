import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPayments, createPayment, updatePayment, deletePayment, listInvoices } from '../../services/finance';
import { getStudent, listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import StudentFinanceReadinessCard from '../../components/StudentFinanceReadinessCard';
import { FINANCE_ENFORCE_FEE_GUARDIAN } from '../../config/flags';
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
/** Invoice statuses that are still owed — a payment can be applied to these. */
const OPEN_INVOICE_STATUSES = ['draft', 'generated', 'sent', 'partially_paid', 'overdue', 'disputed'];
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

// 007 — no `status` field: counter/manual capture is always 'success' (the API strips it).
// paymentDate defaults to today (en-CA => YYYY-MM-DD in local time, not UTC); operator can still change it.
const newForm = () => ({ studentId: '', receiptNumber: '', amount: '', paymentMode: 'cash', transactionRef: '', paymentDate: new Date().toLocaleDateString('en-CA'), invoiceId: '', remarks: '' });

export default function PaymentsPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [studentFilter, setStudentFilter] = useState(searchParams.get('studentId') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [form, setForm] = useState(newForm);

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      studentId: row.studentId?._id || row.studentId || '',
      receiptNumber: row.receiptNumber || '',
      amount: String(row.amount || ''),
      paymentMode: row.paymentMode || 'cash',
      transactionRef: row.transactionRef || '',
      paymentDate: row.paymentDate ? row.paymentDate.slice(0, 10) : '',
      invoiceId: row.invoiceId || '',
      remarks: row.remarks || '',
    }),
    onOpenCreate: () => setForm(newForm()),
    onClose: () => setForm(newForm()),
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

  // 007 — the student's open invoices, so a payment can be applied to one (default: oldest).
  const { data: invoiceData } = useQuery({
    queryKey: ['open-invoices', form.studentId],
    queryFn: () => listInvoices(1, 50, undefined, form.studentId),
    enabled: vem.isOpen && !vem.isEdit && Boolean(form.studentId),
  });
  const openInvoices = useMemo(() => {
    const items: any[] = invoiceData?.items || [];
    return items
      .filter((i) => OPEN_INVOICE_STATUSES.includes(i.status))
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  }, [invoiceData]);

  // Default the allocation to the oldest unpaid invoice once they load (create mode only).
  useEffect(() => {
    if (!vem.isOpen || vem.isEdit || form.invoiceId) return;
    const first = openInvoices[0];
    if (first) setForm((f) => ({ ...f, invoiceId: first._id }));
  }, [openInvoices, vem.isOpen, vem.isEdit, form.invoiceId]);

  // Guardian block is flag-gated (007 T8): OFF for the demo. The readiness card is advisory
  // and only shown when enforcement is on, so the demo never surfaces a scary "blocked" state.
  const financeBlocked = useMemo(
    () => FINANCE_ENFORCE_FEE_GUARDIAN && Boolean(form.studentId) && Boolean(selectedStudent) && !selectedStudent.feeResponsibleParentId,
    [form.studentId, selectedStudent],
  );
  const financeReadinessPending = FINANCE_ENFORCE_FEE_GUARDIAN && Boolean(form.studentId) && studentReadinessLoading;

  function syncSearch(next: { studentId?: string; status?: string }) {
    const params = new URLSearchParams();
    if (next.studentId) params.set('studentId', next.studentId);
    if (next.status) params.set('status', next.status);
    setSearchParams(params, { replace: true });
  }

  const createMut = useMutation({ mutationFn: createPayment, onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updatePayment(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deletePayment, onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, amount: Number(form.amount) };
    if (!vem.isEdit) delete payload.receiptNumber;
    if (!payload.transactionRef) delete payload.transactionRef;
    if (!payload.remarks) delete payload.remarks;
    if (!payload.invoiceId) delete payload.invoiceId;
    if (vem.isEdit && vem.entity) {
      // 007 — PUT only accepts non-financial fields; send just those.
      updateMut.mutate({ id: vem.entity._id, data: { remarks: form.remarks, transactionRef: form.transactionRef } });
    } else {
      createMut.mutate(payload);
    }
  }

  const saving = createMut.isPending || updateMut.isPending;
  const selectedInvoice = openInvoices.find((i) => i._id === form.invoiceId);

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.personId?.name || r.studentId?.rollNumber || '—'}</span> },
    { key: 'receiptNumber', label: 'Receipt #' },
    { key: 'amount', label: 'Amount', render: (r: any) => `₹${Number(r.amount).toLocaleString()}` },
    { key: 'paymentMode', label: 'Mode', render: (r: any) => <Badge variant="info">{r.paymentMode}</Badge> },
    { key: 'paymentDate', label: 'Date', render: (r: any) => r.paymentDate ? new Date(r.paymentDate).toLocaleDateString() : '-' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex flex-wrap justify-end gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        {/* 007 — delete reverses the balance + invoice, so it is the correction path for a mis-keyed payment. */}
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this payment? Its balance effect will be reversed.', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
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
        emptyMessage={search ? `No payments match “${search}”.` : 'No payments yet.'}
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
          {FINANCE_ENFORCE_FEE_GUARDIAN && form.studentId && (
            <StudentFinanceReadinessCard student={selectedStudent} loading={financeReadinessPending} />
          )}

          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Student * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value, invoiceId: '' }))} className={inp}>
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
                  <input required value={form.receiptNumber} onChange={e => setForm(f => ({ ...f, receiptNumber: e.target.value }))} className={`${inp} disabled:bg-gray-50`} disabled />
                </div>
              ) : (
                <div>
                  <label className={lbl}>Receipt Number</label>
                  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                    Auto-generated when the payment is saved
                  </div>
                </div>
              )}
              {/* 007 — allocate the payment to an open invoice (default: oldest). Create mode only. */}
              {!vem.isEdit && !vem.isView && (
                <div className="col-span-2">
                  <label className={lbl}>Apply to invoice</label>
                  <select value={form.invoiceId} onChange={e => setForm(f => ({ ...f, invoiceId: e.target.value }))} className={inp} disabled={!form.studentId}>
                    <option value="">No invoice (unallocated payment)</option>
                    {openInvoices.map((i) => (
                      <option key={i._id} value={i._id}>
                        {i.invoiceNumber} — ₹{Number(i.netPayable ?? i.totalAmount).toLocaleString()} ({i.status})
                      </option>
                    ))}
                  </select>
                  {selectedInvoice && (
                    <p className="mt-1 text-xs text-gray-500">Invoice amount ₹{Number(selectedInvoice.netPayable ?? selectedInvoice.totalAmount).toLocaleString()} — payment cannot exceed the remaining balance.</p>
                  )}
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
              <div className="col-span-2"><label className={lbl}>Remarks</label><input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className={inp} /></div>
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
