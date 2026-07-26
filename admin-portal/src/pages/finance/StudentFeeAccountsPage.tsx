import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createStudentFeeAccount, deleteStudentFeeAccount, listStudentFeeAccounts, updateStudentFeeAccount } from '../../services/finance';
import { getStudent, listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import StudentFinanceReadinessCard from '../../components/StudentFinanceReadinessCard';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = {
  studentId: '',
  totalDue: '',
  totalPaid: '',
  totalWaived: '',
  totalRefunded: '',
  balance: '',
  lastPaymentDate: '',
};

export default function StudentFeeAccountsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      studentId: row.studentId?._id || row.studentId || '',
      totalDue: row.totalDue != null ? String(row.totalDue) : '',
      totalPaid: row.totalPaid != null ? String(row.totalPaid) : '',
      totalWaived: row.totalWaived != null ? String(row.totalWaived) : '',
      totalRefunded: row.totalRefunded != null ? String(row.totalRefunded) : '',
      balance: row.balance != null ? String(row.balance) : '',
      lastPaymentDate: row.lastPaymentDate ? row.lastPaymentDate.slice(0, 10) : '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const { data, isLoading } = useQuery({ queryKey: ['student-fee-accounts', page, limit, search], queryFn: () => listStudentFeeAccounts(page, limit, search) });
  const { data: studentsData } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 100) });
  const { data: selectedStudent, isFetching: studentReadinessLoading } = useQuery({
    queryKey: ['student-finance-readiness', form.studentId],
    queryFn: () => getStudent(form.studentId),
    enabled: vem.isOpen && Boolean(form.studentId),
  });

  const students = studentsData?.items || [];
  const financeBlocked = useMemo(() => Boolean(form.studentId) && Boolean(selectedStudent) && !selectedStudent.feeResponsibleParentId, [form.studentId, selectedStudent]);
  const financeReadinessPending = Boolean(form.studentId) && studentReadinessLoading;

  const createMut = useMutation({ mutationFn: createStudentFeeAccount, onSuccess: () => { qc.invalidateQueries({ queryKey: ['student-fee-accounts'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateStudentFeeAccount(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['student-fee-accounts'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteStudentFeeAccount, onSuccess: () => { qc.invalidateQueries({ queryKey: ['student-fee-accounts'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { studentId: form.studentId };
    // Only the assessed amount is caller-supplied; totalPaid/Waived/Refunded
    // and balance are owned by the payment pipeline and rejected by the API.
    if (form.totalDue !== '') payload.totalDue = Number(form.totalDue);
    if (form.lastPaymentDate) payload.lastPaymentDate = form.lastPaymentDate;

    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.personId?.name || r.studentId?.rollNumber || '—'}</span> },
    { key: 'totalDue', label: 'Total Due', render: (r: any) => `₹${Number(r.totalDue || 0).toLocaleString()}` },
    { key: 'totalPaid', label: 'Total Paid', render: (r: any) => `₹${Number(r.totalPaid || 0).toLocaleString()}` },
    { key: 'totalWaived', label: 'Waived', render: (r: any) => `₹${Number(r.totalWaived || 0).toLocaleString()}` },
    { key: 'totalRefunded', label: 'Refunded', render: (r: any) => `₹${Number(r.totalRefunded || 0).toLocaleString()}` },
    { key: 'balance', label: 'Balance', render: (r: any) => `₹${Number(r.balance || 0).toLocaleString()}` },
    { key: 'lastPaymentDate', label: 'Last Payment', render: (r: any) => r.lastPaymentDate ? new Date(r.lastPaymentDate).toLocaleDateString() : '—' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this fee account?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Student Fee Accounts</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search student fee accounts…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Fee Account
        </button>
      </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
        emptyState={
          <div className="space-y-2">
            <div className="font-medium text-slate-600">No fee accounts yet</div>
            <div className="text-sm text-gray-400">Create a student fee account to start tracking balances, waivers, refunds, and payment totals.</div>
          </div>
        }
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Student Fee Account')}>
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
                  {students.map((s: any) => (
                    <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Total Due</label><input type="number" min={0} value={form.totalDue} onChange={(e) => setForm((f) => ({ ...f, totalDue: e.target.value }))} className={inp} /></div>

              {/* Derived from the payment ledger — the backend maintains these
                  with $inc on every payment/waiver/refund. Editing them by hand
                  desyncs the account from its transactions, so they are shown
                  read-only rather than as inputs. */}
              <div className="col-span-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Computed from payments — not editable
                  </p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
                    {([
                      ['Total Paid', form.totalPaid],
                      ['Total Waived', form.totalWaived],
                      ['Total Refunded', form.totalRefunded],
                      ['Balance', form.balance],
                    ] as const).map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-slate-500">{label}</dt>
                        <dd className="font-medium text-slate-800">
                          ₹{Number(value || 0).toLocaleString('en-IN')}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 text-xs text-slate-400">
                    Record a payment, waiver or refund to change these figures.
                  </p>
                </div>
              </div>
              <div><label className={lbl}>Last Payment Date</label><input type="date" value={form.lastPaymentDate} onChange={(e) => setForm((f) => ({ ...f, lastPaymentDate: e.target.value }))} className={inp} /></div>
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
