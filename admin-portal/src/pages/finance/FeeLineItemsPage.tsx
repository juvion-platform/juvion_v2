import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFeeLineItem, deleteFeeLineItem, listFeeLineItems, updateFeeLineItem, listFeeStructures } from '../../services/finance';
import { getStudent, listStudents } from '../../services/people';
import { listAcademicYears } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import StudentFinanceReadinessCard from '../../components/StudentFinanceReadinessCard';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const STATUSES = ['pending', 'partial', 'paid', 'overdue', 'waived'] as const;
const STATUS_COLOR: Record<string, string> = { pending: 'default', partial: 'warning', paid: 'success', overdue: 'danger', waived: 'info' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = {
  studentId: '',
  feeStructureId: '',
  component: '',
  academicYearId: '',
  semester: '',
  amount: '',
  paidAmount: '',
  waivedAmount: '',
  dueDate: '',
  status: 'pending',
};

export default function FeeLineItemsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState(emptyForm);

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      studentId: row.studentId?._id || row.studentId || '',
      feeStructureId: row.feeStructureId?._id || row.feeStructureId || '',
      component: row.component || '',
      academicYearId: row.academicYearId?._id || row.academicYearId || '',
      semester: row.semester != null ? String(row.semester) : '',
      amount: row.amount != null ? String(row.amount) : '',
      paidAmount: row.paidAmount != null ? String(row.paidAmount) : '',
      waivedAmount: row.waivedAmount != null ? String(row.waivedAmount) : '',
      dueDate: row.dueDate ? row.dueDate.slice(0, 10) : '',
      status: row.status || 'pending',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const { data, isLoading } = useQuery({ queryKey: ['fee-line-items', page, statusFilter], queryFn: () => listFeeLineItems(page, 20, undefined, statusFilter || undefined) });
  const { data: studentsData } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 100) });
  const { data: feeStructures } = useQuery({ queryKey: ['fee-structures-all'], queryFn: () => listFeeStructures(1, 100) });
  const { data: academicYears } = useQuery({ queryKey: ['academic-years-all'], queryFn: () => listAcademicYears(1, 100) });
  const { data: selectedStudent, isFetching: studentReadinessLoading } = useQuery({
    queryKey: ['student-finance-readiness', form.studentId],
    queryFn: () => getStudent(form.studentId),
    enabled: vem.isOpen && Boolean(form.studentId),
  });

  const students = studentsData?.items || [];
  const financeBlocked = useMemo(() => Boolean(form.studentId) && Boolean(selectedStudent) && !selectedStudent.feeResponsibleParentId, [form.studentId, selectedStudent]);
  const financeReadinessPending = Boolean(form.studentId) && studentReadinessLoading;

  const createMut = useMutation({ mutationFn: createFeeLineItem, onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-line-items'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateFeeLineItem(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-line-items'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteFeeLineItem, onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-line-items'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      studentId: form.studentId,
      component: form.component,
      academicYearId: form.academicYearId,
      amount: Number(form.amount),
      status: form.status,
    };
    if (form.feeStructureId) payload.feeStructureId = form.feeStructureId;
    if (form.semester) payload.semester = Number(form.semester);
    if (form.paidAmount !== '') payload.paidAmount = Number(form.paidAmount);
    if (form.waivedAmount !== '') payload.waivedAmount = Number(form.waivedAmount);
    if (form.dueDate) payload.dueDate = form.dueDate;

    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.personId?.name || r.studentId?.rollNumber || '—'}</span> },
    { key: 'component', label: 'Component' },
    { key: 'academicYearId', label: 'Academic Year', render: (r: any) => r.academicYearId?.name || r.academicYearId?.code || r.academicYearId?.label || '—' },
    { key: 'semester', label: 'Semester', render: (r: any) => r.semester || '—' },
    { key: 'amount', label: 'Amount', render: (r: any) => `₹${Number(r.amount || 0).toLocaleString()}` },
    { key: 'paidAmount', label: 'Paid', render: (r: any) => `₹${Number(r.paidAmount || 0).toLocaleString()}` },
    { key: 'waivedAmount', label: 'Waived', render: (r: any) => `₹${Number(r.waivedAmount || 0).toLocaleString()}` },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this fee line item?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Fee Line Items</h2>
        <div className="flex gap-3">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> New Fee Line Item
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
            <div className="font-medium text-slate-600">No fee line items yet</div>
            <div className="text-sm text-gray-400">Line items represent payable components like tuition, hostel, transport, or penalties for a specific student.</div>
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Fee Line Item')}>
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
              <div>
                <label className={lbl}>Academic Year * {!vem.isView && <Link to="/academics/academic-years" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.academicYearId} onChange={(e) => setForm((f) => ({ ...f, academicYearId: e.target.value }))} className={inp}>
                  <option value="">Select academic year</option>
                  {(academicYears?.items || []).map((item: any) => (
                    <option key={item._id} value={item._id}>{item.name || item.code || item.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Fee Structure {!vem.isView && <Link to="/finance/fee-structures" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.feeStructureId} onChange={(e) => setForm((f) => ({ ...f, feeStructureId: e.target.value }))} className={inp}>
                  <option value="">None</option>
                  {(feeStructures?.items || []).map((item: any) => (
                    <option key={item._id} value={item._id}>
                      {(item.programmeId?.name || 'Programme')} - Year {item.year}
                    </option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Component *</label><input required value={form.component} onChange={(e) => setForm((f) => ({ ...f, component: e.target.value }))} className={inp} placeholder="e.g. Tuition Fee" /></div>
              <div><label className={lbl}>Semester</label><input type="number" min={1} value={form.semester} onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Amount *</label><input required type="number" min={0} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Paid Amount</label><input type="number" min={0} value={form.paidAmount} onChange={(e) => setForm((f) => ({ ...f, paidAmount: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Waived Amount</label><input type="number" min={0} value={form.waivedAmount} onChange={(e) => setForm((f) => ({ ...f, waivedAmount: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Due Date</label><input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className={inp} /></div>
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
