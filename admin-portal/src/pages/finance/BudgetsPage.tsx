import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listBudgets, createBudget, updateBudget, deleteBudget } from '../../services/finance';
import { listAcademicYears, listDepartments } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const STATUSES = ['draft', 'approved', 'active', 'closed'] as const;
const STATUS_COLOR: Record<string, string> = { draft: 'default', approved: 'info', active: 'success', closed: 'warning' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { academicYearId: '', departmentId: '', category: '', allocatedAmount: '', spentAmount: '', status: 'draft' };

export default function BudgetsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['budgets', page, limit, search], queryFn: () => listBudgets(page, limit, undefined, search) });
  const { data: ayData } = useQuery({ queryKey: ['academicYears', 'all'], queryFn: () => listAcademicYears(1, 100) });
  const { data: deptData } = useQuery({ queryKey: ['departments', 'all'], queryFn: () => listDepartments(1, 100) });

  const academicYears = ayData?.items || [];
  const departments = deptData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      academicYearId: row.academicYearId?._id || row.academicYearId || '',
      departmentId: row.departmentId?._id || row.departmentId || '',
      category: row.category || '',
      allocatedAmount: String(row.allocatedAmount || ''),
      spentAmount: row.spentAmount != null ? String(row.spentAmount) : '',
      status: row.status || 'draft',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createBudget, onSuccess: () => { qc.invalidateQueries({ queryKey: ['budgets'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateBudget(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['budgets'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteBudget, onSuccess: () => { qc.invalidateQueries({ queryKey: ['budgets'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, allocatedAmount: Number(form.allocatedAmount) };
    if (form.spentAmount) payload.spentAmount = Number(form.spentAmount);
    else delete payload.spentAmount;
    if (!payload.departmentId) delete payload.departmentId;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'academicYear', label: 'Academic Year', render: (r: any) => r.academicYearId?.label || r.academicYearId?.code || '\u2014' },
    { key: 'department', label: 'Department', render: (r: any) => r.departmentId?.name || '\u2014' },
    { key: 'category', label: 'Category', render: (r: any) => <span className="font-medium text-navy">{r.category}</span> },
    { key: 'allocatedAmount', label: 'Allocated', render: (r: any) => `₹${Number(r.allocatedAmount).toLocaleString()}` },
    { key: 'spentAmount', label: 'Spent', render: (r: any) => `₹${Number(r.spentAmount || 0).toLocaleString()}` },
    { key: 'utilization', label: 'Utilization', render: (r: any) => {
      const spent = Number(r.spentAmount || 0);
      const allocated = Number(r.allocatedAmount || 1);
      return `${spent.toLocaleString()} / ${allocated.toLocaleString()}`;
    }},
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this budget?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Budgets</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search budgets…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Budget
        </button>
      </div>
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Budget')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Academic Year * {!vem.isView && <Link to="/academics/academic-years" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))} className={inp}>
                  <option value="">Select academic year</option>
                  {academicYears.map((ay: any) => <option key={ay._id} value={ay._id}>{ay.label || ay.code}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Department</label>
                <select value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} className={inp}>
                  <option value="">None</option>
                  {departments.map((d: any) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Category *</label><input required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Allocated Amount *</label><input required type="number" min={0} value={form.allocatedAmount} onChange={e => setForm(f => ({ ...f, allocatedAmount: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Spent Amount</label><input type="number" min={0} value={form.spentAmount} onChange={e => setForm(f => ({ ...f, spentAmount: e.target.value }))} className={inp} /></div>
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
