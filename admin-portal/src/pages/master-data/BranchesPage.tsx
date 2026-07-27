import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listBranches, createBranch, updateBranch, deleteBranch, listProgrammes, listDepartments } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = { code: '', name: '', programmeId: '', departmentId: '', intake: '', isActive: true };

export default function BranchesPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['branches', page, limit, search], queryFn: () => listBranches(page, limit, search) });
  const { data: progsData } = useQuery({ queryKey: ['programmes', 1, 100], queryFn: () => listProgrammes(1, 100) });
  const { data: deptsData } = useQuery({ queryKey: ['departments', 1, 100], queryFn: () => listDepartments(1, 100) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      code: row.code,
      name: row.name,
      programmeId: row.programmeId?._id || row.programmeId || '',
      departmentId: row.departmentId?._id || row.departmentId || '',
      intake: String(row.intake),
      isActive: row.isActive,
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({
    mutationFn: createBranch,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); vem.close(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => updateBranch(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); vem.close(); },
  });
  const deleteMut = useMutation({
    mutationFn: deleteBranch,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, intake: Number(form.intake) };
    if (!payload.departmentId) delete payload.departmentId;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'code', label: 'Code', render: (r: any) => <span className="font-medium text-navy">{r.code}</span> },
    { key: 'name', label: 'Name' },
    { key: 'intake', label: 'Intake' },
    { key: 'isActive', label: 'Status', render: (r: any) => <Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this branch?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Branches</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search branches…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Branch
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Branch')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Code *</label><input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className={inp} placeholder="e.g. CSE" /></div>
              <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="e.g. Computer Science & Engineering" /></div>
              <div><label className={lbl}>Programme *</label>
                <select required value={form.programmeId} onChange={e => setForm(f => ({ ...f, programmeId: e.target.value }))} className={inp}>
                  <option value="">Select programme...</option>
                  {progsData?.items?.map((p: any) => <option key={p._id} value={p._id}>{p.code} — {p.name}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Department</label>
                <select value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} className={inp}>
                  <option value="">Select department...</option>
                  {deptsData?.items?.map((d: any) => <option key={d._id} value={d._id}>{d.code} — {d.name}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Intake *</label><input required type="number" min={0} value={form.intake} onChange={e => setForm(f => ({ ...f, intake: e.target.value }))} className={inp} /></div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="brIsActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                <label htmlFor="brIsActive" className="text-sm text-gray-700">Active</label>
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
