import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createStudentFeeAccount, deleteStudentFeeAccount, listStudentFeeAccounts, updateStudentFeeAccount } from '../../services/finance';
import { getStudent, listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import StudentFinanceReadinessCard from '../../components/StudentFinanceReadinessCard';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function StudentFeeAccountsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    studentId: '',
    totalDue: '',
    totalPaid: '',
    totalWaived: '',
    totalRefunded: '',
    balance: '',
    lastPaymentDate: '',
  });

  const { data, isLoading } = useQuery({ queryKey: ['student-fee-accounts', page], queryFn: () => listStudentFeeAccounts(page, 20) });
  const { data: studentsData } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 100) });
  const { data: selectedStudent, isFetching: studentReadinessLoading } = useQuery({
    queryKey: ['student-finance-readiness', form.studentId],
    queryFn: () => getStudent(form.studentId),
    enabled: modalOpen && Boolean(form.studentId),
  });

  const students = studentsData?.items || [];
  const financeBlocked = useMemo(() => Boolean(form.studentId) && Boolean(selectedStudent) && !selectedStudent.feeResponsibleParentId, [form.studentId, selectedStudent]);
  const financeReadinessPending = Boolean(form.studentId) && studentReadinessLoading;

  const createMut = useMutation({ mutationFn: createStudentFeeAccount, onSuccess: () => { qc.invalidateQueries({ queryKey: ['student-fee-accounts'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateStudentFeeAccount(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['student-fee-accounts'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteStudentFeeAccount, onSuccess: () => { qc.invalidateQueries({ queryKey: ['student-fee-accounts'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ studentId: '', totalDue: '', totalPaid: '', totalWaived: '', totalRefunded: '', balance: '', lastPaymentDate: '' });
    setModalOpen(true);
  }

  function openEdit(row: any) {
    setEditing(row);
    setForm({
      studentId: row.studentId?._id || row.studentId || '',
      totalDue: row.totalDue != null ? String(row.totalDue) : '',
      totalPaid: row.totalPaid != null ? String(row.totalPaid) : '',
      totalWaived: row.totalWaived != null ? String(row.totalWaived) : '',
      totalRefunded: row.totalRefunded != null ? String(row.totalRefunded) : '',
      balance: row.balance != null ? String(row.balance) : '',
      lastPaymentDate: row.lastPaymentDate ? row.lastPaymentDate.slice(0, 10) : '',
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { studentId: form.studentId };
    if (form.totalDue !== '') payload.totalDue = Number(form.totalDue);
    if (form.totalPaid !== '') payload.totalPaid = Number(form.totalPaid);
    if (form.totalWaived !== '') payload.totalWaived = Number(form.totalWaived);
    if (form.totalRefunded !== '') payload.totalRefunded = Number(form.totalRefunded);
    if (form.balance !== '') payload.balance = Number(form.balance);
    if (form.lastPaymentDate) payload.lastPaymentDate = form.lastPaymentDate;

    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

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
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this fee account?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Student Fee Accounts</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Fee Account
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        emptyState={
          <div className="space-y-2">
            <div className="font-medium text-slate-600">No fee accounts yet</div>
            <div className="text-sm text-gray-400">Create a student fee account to start tracking balances, waivers, refunds, and payment totals.</div>
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Student Fee Account' : 'New Student Fee Account'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {form.studentId && (
            <StudentFinanceReadinessCard student={selectedStudent} loading={financeReadinessPending} />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Student * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))} className={inp}>
                <option value="">Select student</option>
                {students.map((s: any) => (
                  <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>
                ))}
              </select>
            </div>
            <div><label className={lbl}>Balance</label><input type="number" min={0} value={form.balance} onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Total Due</label><input type="number" min={0} value={form.totalDue} onChange={(e) => setForm((f) => ({ ...f, totalDue: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Total Paid</label><input type="number" min={0} value={form.totalPaid} onChange={(e) => setForm((f) => ({ ...f, totalPaid: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Total Waived</label><input type="number" min={0} value={form.totalWaived} onChange={(e) => setForm((f) => ({ ...f, totalWaived: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Total Refunded</label><input type="number" min={0} value={form.totalRefunded} onChange={(e) => setForm((f) => ({ ...f, totalRefunded: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Last Payment Date</label><input type="date" value={form.lastPaymentDate} onChange={(e) => setForm((f) => ({ ...f, lastPaymentDate: e.target.value }))} className={inp} /></div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending || (!editing && (financeBlocked || financeReadinessPending))} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              {createMut.isPending || updateMut.isPending ? 'Saving...' : financeReadinessPending ? 'Checking student...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
