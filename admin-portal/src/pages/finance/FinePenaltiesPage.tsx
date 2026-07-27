import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listFinePenalties, createFinePenalty, updateFinePenalty, deleteFinePenalty } from '../../services/finance';
import { getStudent, listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import StudentFinanceReadinessCard from '../../components/StudentFinanceReadinessCard';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const TYPES = ['late_fee', 'library', 'disciplinary', 'damage', 'other'] as const;
const STATUSES = ['pending', 'partial', 'paid', 'waived'] as const;
const STATUS_COLOR: Record<string, string> = { pending: 'default', partial: 'warning', paid: 'success', waived: 'info' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { studentId: '', type: 'late_fee', reason: '', amount: '', dueDate: '', paidAmount: '', status: 'pending' };

export default function FinePenaltiesPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      studentId: row.studentId?._id || row.studentId || '',
      type: row.type || 'late_fee',
      reason: row.reason || '',
      amount: String(row.amount || ''),
      dueDate: row.dueDate ? row.dueDate.slice(0, 10) : '',
      paidAmount: row.paidAmount != null ? String(row.paidAmount) : '',
      status: row.status || 'pending',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const { data, isLoading } = useQuery({ queryKey: ['fines', page, limit, search], queryFn: () => listFinePenalties(page, limit, undefined, search) });
  const { data: studentsData } = useQuery({ queryKey: ['students-list'], queryFn: () => listStudents(1, 100) });
  const { data: selectedStudent, isFetching: studentReadinessLoading } = useQuery({
    queryKey: ['student-finance-readiness', form.studentId],
    queryFn: () => getStudent(form.studentId),
    enabled: vem.isOpen && Boolean(form.studentId),
  });
  const students: any[] = studentsData?.items || [];
  const financeBlocked = useMemo(() => Boolean(form.studentId) && Boolean(selectedStudent) && !selectedStudent.feeResponsibleParentId, [form.studentId, selectedStudent]);
  const financeReadinessPending = Boolean(form.studentId) && studentReadinessLoading;

  const createMut = useMutation({ mutationFn: createFinePenalty, onSuccess: () => { qc.invalidateQueries({ queryKey: ['fines'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateFinePenalty(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fines'] }); vem.close(); } });
  const quickUpdateMut = useMutation({ mutationFn: ({ id, data }: any) => updateFinePenalty(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fines'] }); } });
  const deleteMut = useMutation({ mutationFn: deleteFinePenalty, onSuccess: () => { qc.invalidateQueries({ queryKey: ['fines'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, amount: Number(form.amount) };
    if (form.paidAmount) payload.paidAmount = Number(form.paidAmount);
    else delete payload.paidAmount;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  function quickTransition(row: any, nextStatus: string) {
    const payload: any = { status: nextStatus };
    if (nextStatus === 'paid') payload.paidAmount = row.amount;
    quickUpdateMut.mutate({ id: row._id, data: payload });
  }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014'}</span> },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant="info">{r.type}</Badge> },
    { key: 'reason', label: 'Reason' },
    { key: 'amount', label: 'Amount', render: (r: any) => `₹${Number(r.amount).toLocaleString()}` },
    { key: 'paidAmount', label: 'Paid', render: (r: any) => `₹${Number(r.paidAmount || 0).toLocaleString()}` },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex flex-wrap justify-end gap-1">
        {(r.status === 'pending' || r.status === 'partial') && (
          <>
            <button onClick={(e) => { e.stopPropagation(); quickTransition(r, 'paid'); }} disabled={quickUpdateMut.isPending} className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
              Mark paid
            </button>
            <button onClick={(e) => { e.stopPropagation(); quickTransition(r, 'waived'); }} disabled={quickUpdateMut.isPending} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50">
              Waive
            </button>
          </>
        )}
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this fine?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Fines & Penalties</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search fines & penalties…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Fine
        </button>
      </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
        emptyMessage={search ? `No fines & penalties match “${search}”.` : 'No fines & penalties yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Fine')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {form.studentId && (
            <StudentFinanceReadinessCard student={selectedStudent} loading={financeReadinessPending} />
          )}

          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Student * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student...</option>
                  {students.map((s: any) => (
                    <option key={s._id} value={s._id}>
                      {s.person?.name || s.rollNumber || s._id}
                    </option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Type *</label>
                <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className={lbl}>Reason *</label><input required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Amount *</label><input required type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Due Date *</label><input required type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Paid Amount</label><input type="number" min={0} value={form.paidAmount} onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
