import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createScholarshipAllocation, deleteScholarshipAllocation, listScholarshipAllocations, listScholarships, updateScholarshipAllocation } from '../../services/finance';
import { getStudent, listStudents } from '../../services/people';
import { listAcademicYears } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import StudentFinanceReadinessCard from '../../components/StudentFinanceReadinessCard';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

const STATUSES = ['applied', 'approved', 'disbursed', 'rejected'] as const;
const STATUS_COLOR: Record<string, string> = { applied: 'default', approved: 'info', disbursed: 'success', rejected: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function ScholarshipAllocationsPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [scholarshipFilter, setScholarshipFilter] = useState(searchParams.get('scholarshipId') || '');
  const [studentFilter, setStudentFilter] = useState(searchParams.get('studentId') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    scholarshipId: '',
    studentId: '',
    academicYearId: '',
    amount: '',
    status: 'applied',
    disbursedDate: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['scholarship-allocations', page, scholarshipFilter, studentFilter, statusFilter],
    queryFn: () => listScholarshipAllocations(page, 20, scholarshipFilter || undefined, studentFilter || undefined, statusFilter || undefined),
  });
  const { data: scholarshipsData } = useQuery({ queryKey: ['scholarships-all'], queryFn: () => listScholarships(1, 100) });
  const { data: studentsData } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 100) });
  const { data: academicYearsData } = useQuery({ queryKey: ['academic-years-all'], queryFn: () => listAcademicYears(1, 100) });
  const { data: selectedStudent, isFetching: studentReadinessLoading } = useQuery({
    queryKey: ['student-finance-readiness', form.studentId],
    queryFn: () => getStudent(form.studentId),
    enabled: modalOpen && Boolean(form.studentId),
  });

  const scholarships = scholarshipsData?.items || [];
  const students = studentsData?.items || [];
  const academicYears = academicYearsData?.items || [];
  const financeBlocked = useMemo(() => Boolean(form.studentId) && Boolean(selectedStudent) && !selectedStudent.feeResponsibleParentId, [form.studentId, selectedStudent]);
  const financeReadinessPending = Boolean(form.studentId) && studentReadinessLoading;

  function syncSearch(next: { scholarshipId?: string; studentId?: string; status?: string }) {
    const params = new URLSearchParams();
    if (next.scholarshipId) params.set('scholarshipId', next.scholarshipId);
    if (next.studentId) params.set('studentId', next.studentId);
    if (next.status) params.set('status', next.status);
    setSearchParams(params, { replace: true });
  }

  const createMut = useMutation({ mutationFn: createScholarshipAllocation, onSuccess: () => { qc.invalidateQueries({ queryKey: ['scholarship-allocations'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateScholarshipAllocation(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['scholarship-allocations'] }); closeModal(); } });
  const quickUpdateMut = useMutation({ mutationFn: ({ id, data }: any) => updateScholarshipAllocation(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['scholarship-allocations'] }); } });
  const deleteMut = useMutation({ mutationFn: deleteScholarshipAllocation, onSuccess: () => { qc.invalidateQueries({ queryKey: ['scholarship-allocations'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ scholarshipId: '', studentId: '', academicYearId: '', amount: '', status: 'applied', disbursedDate: '' });
    setModalOpen(true);
  }

  function openEdit(row: any) {
    setEditing(row);
    setForm({
      scholarshipId: row.scholarshipId?._id || row.scholarshipId || '',
      studentId: row.studentId?._id || row.studentId || '',
      academicYearId: row.academicYearId?._id || row.academicYearId || '',
      amount: row.amount != null ? String(row.amount) : '',
      status: row.status || 'applied',
      disbursedDate: row.disbursedDate ? row.disbursedDate.slice(0, 10) : '',
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      scholarshipId: form.scholarshipId,
      studentId: form.studentId,
      academicYearId: form.academicYearId,
      amount: Number(form.amount),
      status: form.status,
    };
    if (form.disbursedDate) payload.disbursedDate = form.disbursedDate;

    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  function quickTransition(row: any, nextStatus: string) {
    const payload: any = { status: nextStatus };
    if (nextStatus === 'disbursed' && !row.disbursedDate) {
      payload.disbursedDate = new Date().toISOString().slice(0, 10);
    }
    quickUpdateMut.mutate({ id: row._id, data: payload });
  }

  const columns = [
    { key: 'scholarshipId', label: 'Scholarship', render: (r: any) => <span className="font-medium text-navy">{r.scholarshipId?.name || '—'}</span> },
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.personId?.name || r.studentId?.rollNumber || '—' },
    { key: 'academicYearId', label: 'Academic Year', render: (r: any) => r.academicYearId?.label || r.academicYearId?.code || '—' },
    { key: 'amount', label: 'Amount', render: (r: any) => `₹${Number(r.amount || 0).toLocaleString()}` },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex flex-wrap gap-1 justify-end">
        {r.status === 'applied' && (
          <>
            <button onClick={(e) => { e.stopPropagation(); quickTransition(r, 'approved'); }} disabled={quickUpdateMut.isPending} className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50">
              Approve
            </button>
            <button onClick={(e) => { e.stopPropagation(); quickTransition(r, 'rejected'); }} disabled={quickUpdateMut.isPending} className="rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50">
              Reject
            </button>
          </>
        )}
        {r.status === 'approved' && (
          <>
            <button onClick={(e) => { e.stopPropagation(); quickTransition(r, 'disbursed'); }} disabled={quickUpdateMut.isPending} className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
              Disburse
            </button>
            <button onClick={(e) => { e.stopPropagation(); quickTransition(r, 'rejected'); }} disabled={quickUpdateMut.isPending} className="rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50">
              Reject
            </button>
          </>
        )}
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this scholarship allocation?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Scholarship Allocations</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Allocation
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <select value={scholarshipFilter} onChange={(e) => {
          const value = e.target.value;
          setScholarshipFilter(value);
          setPage(1);
          syncSearch({ scholarshipId: value, studentId: studentFilter, status: statusFilter });
        }} className={inp}>
          <option value="">All Scholarships</option>
          {scholarships.map((item: any) => <option key={item._id} value={item._id}>{item.name}</option>)}
        </select>
        <select value={studentFilter} onChange={(e) => {
          const value = e.target.value;
          setStudentFilter(value);
          setPage(1);
          syncSearch({ scholarshipId: scholarshipFilter, studentId: value, status: statusFilter });
        }} className={inp}>
          <option value="">All Students</option>
          {students.map((item: any) => <option key={item._id} value={item._id}>{item.person?.name || item.rollNumber || item._id}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => {
          const value = e.target.value;
          setStatusFilter(value);
          setPage(1);
          syncSearch({ scholarshipId: scholarshipFilter, studentId: studentFilter, status: value });
        }} className={inp}>
          <option value="">All Statuses</option>
          {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </div>

      <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
        Scholarship allocations link a scholarship definition to a specific student and academic year. Students missing a fee guardian are blocked here to keep finance ownership consistent.
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        emptyState={
          <div className="space-y-2">
            <div className="font-medium text-slate-600">No scholarship allocations yet</div>
            <div className="text-sm text-gray-400">Start by creating an allocation for an eligible student from an active scholarship.</div>
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Scholarship Allocation' : 'New Scholarship Allocation'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {form.studentId && (
            <StudentFinanceReadinessCard student={selectedStudent} loading={financeReadinessPending} />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Scholarship * <Link to="/finance/scholarships" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.scholarshipId} onChange={(e) => setForm((f) => ({ ...f, scholarshipId: e.target.value }))} className={inp}>
                <option value="">Select scholarship</option>
                {scholarships.map((item: any) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Student * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))} className={inp}>
                <option value="">Select student</option>
                {students.map((item: any) => <option key={item._id} value={item._id}>{item.person?.name || item.rollNumber || item._id}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Academic Year * <Link to="/academics/academic-years" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.academicYearId} onChange={(e) => setForm((f) => ({ ...f, academicYearId: e.target.value }))} className={inp}>
                <option value="">Select academic year</option>
                {academicYears.map((item: any) => <option key={item._id} value={item._id}>{item.label || item.code}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Amount *</label><input required type="number" min={0} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Status *</label>
              <select required value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Disbursed Date</label><input type="date" value={form.disbursedDate} onChange={(e) => setForm((f) => ({ ...f, disbursedDate: e.target.value }))} className={inp} /></div>
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
