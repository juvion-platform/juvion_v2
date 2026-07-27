import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listInvoices, createInvoice, updateInvoice, deleteInvoice } from '../../services/finance';
import { getStudent, listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import StudentFinanceReadinessCard from '../../components/StudentFinanceReadinessCard';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const TYPES = ['fee', 'hostel', 'transport', 'other'] as const;
const STATUSES = ['draft', 'issued', 'paid', 'overdue', 'cancelled'] as const;
const STATUS_COLOR: Record<string, string> = { draft: 'default', issued: 'info', paid: 'success', overdue: 'danger', cancelled: 'warning' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = { invoiceNumber: '', studentId: '', type: 'fee', totalAmount: '', dueDate: '', status: 'draft', issuedDate: '' };

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [studentFilter, setStudentFilter] = useState(searchParams.get('studentId') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [form, setForm] = useState(emptyForm);

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      invoiceNumber: row.invoiceNumber || '',
      studentId: row.studentId?._id || row.studentId || '',
      type: row.type || 'fee',
      totalAmount: String(row.totalAmount || ''),
      dueDate: row.dueDate ? row.dueDate.slice(0, 10) : '',
      status: row.status || 'draft',
      issuedDate: row.issuedDate ? row.issuedDate.slice(0, 10) : '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, statusFilter, studentFilter, limit, search],
    queryFn: () => listInvoices(page, limit, statusFilter || undefined, studentFilter || undefined, search),
  });
  const { data: studentsData } = useQuery({ queryKey: ['students-list'], queryFn: () => listStudents(1, 100) });
  const { data: selectedStudent, isFetching: studentReadinessLoading } = useQuery({
    queryKey: ['student-finance-readiness', form.studentId],
    queryFn: () => getStudent(form.studentId),
    enabled: vem.isOpen && Boolean(form.studentId),
  });

  const students = studentsData?.items || [];
  const financeBlocked = useMemo(() => Boolean(form.studentId) && Boolean(selectedStudent) && !selectedStudent.feeResponsibleParentId, [form.studentId, selectedStudent]);
  const financeReadinessPending = Boolean(form.studentId) && studentReadinessLoading;

  function syncSearch(next: { studentId?: string; status?: string }) {
    const params = new URLSearchParams();
    if (next.studentId) params.set('studentId', next.studentId);
    if (next.status) params.set('status', next.status);
    setSearchParams(params, { replace: true });
  }

  const createMut = useMutation({ mutationFn: createInvoice, onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateInvoice(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); vem.close(); } });
  const quickUpdateMut = useMutation({ mutationFn: ({ id, data }: any) => updateInvoice(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); } });
  const deleteMut = useMutation({ mutationFn: deleteInvoice, onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, totalAmount: Number(form.totalAmount) };
    if (!payload.studentId) delete payload.studentId;
    if (!payload.issuedDate) delete payload.issuedDate;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  function quickTransition(row: any, nextStatus: string) {
    const payload: any = { status: nextStatus };
    if (nextStatus === 'issued' && !row.issuedDate) {
      payload.issuedDate = new Date().toISOString().slice(0, 10);
    }
    quickUpdateMut.mutate({ id: row._id, data: payload });
  }

  function studentLabel(s: any) {
    return s.person?.name || s.rollNumber || s._id;
  }

  const columns = [
    { key: 'invoiceNumber', label: 'Invoice #', render: (r: any) => <span className="font-medium text-navy">{r.invoiceNumber}</span> },
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.personId?.name || r.studentId?.rollNumber || '—' },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant="info">{r.type}</Badge> },
    { key: 'totalAmount', label: 'Total', render: (r: any) => `₹${Number(r.totalAmount).toLocaleString()}` },
    { key: 'dueDate', label: 'Due Date', render: (r: any) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '-' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex flex-wrap justify-end gap-1">
        {r.status === 'draft' && (
          <>
            <button onClick={(e) => { e.stopPropagation(); quickTransition(r, 'issued'); }} disabled={quickUpdateMut.isPending} className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50">
              Issue
            </button>
            <button onClick={(e) => { e.stopPropagation(); quickTransition(r, 'cancelled'); }} disabled={quickUpdateMut.isPending} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50">
              Cancel
            </button>
          </>
        )}
        {(r.status === 'issued' || r.status === 'overdue') && (
          <>
            <button onClick={(e) => { e.stopPropagation(); quickTransition(r, 'paid'); }} disabled={quickUpdateMut.isPending} className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
              Mark paid
            </button>
            {r.status === 'issued' && (
              <button onClick={(e) => { e.stopPropagation(); quickTransition(r, 'overdue'); }} disabled={quickUpdateMut.isPending} className="rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50">
                Mark overdue
              </button>
            )}
          </>
        )}
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this invoice?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Invoices</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search invoices…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Invoice
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
          {students.map((s: any) => <option key={s._id} value={s._id}>{studentLabel(s)}</option>)}
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
        emptyMessage={search ? `No invoices match “${search}”.` : 'No invoices yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Invoice')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {form.studentId && (
            <StudentFinanceReadinessCard student={selectedStudent} loading={financeReadinessPending} />
          )}

          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Invoice Number *</label><input required value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Student</label>
                <select value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">None</option>
                  {students.map((s: any) => <option key={s._id} value={s._id}>{studentLabel(s)}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Type *</label>
                <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Total Amount *</label><input required type="number" min={0} value={form.totalAmount} onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Due Date *</label><input required type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Issued Date</label><input type="date" value={form.issuedDate} onChange={e => setForm(f => ({ ...f, issuedDate: e.target.value }))} className={inp} /></div>
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
              <button type="submit" disabled={saving || (!vem.isEdit && Boolean(form.studentId) && (financeBlocked || financeReadinessPending))} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Saving…' : financeReadinessPending ? 'Checking student...' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
