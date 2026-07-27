import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listDepartments, createDepartment, updateDepartment, deleteDepartment } from '../../services/academics';
import { listFaculty } from '../../services/people';
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

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { code: '', name: '', hodId: '', isActive: true };

export default function DepartmentsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['departments', page, limit, search], queryFn: () => listDepartments(page, limit, search) });
  const { data: facultyData } = useQuery({ queryKey: ['faculty-all'], queryFn: () => listFaculty(1, 200) });
  const faculty = facultyData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      code: row.code,
      name: row.name,
      hodId: row.hodId?._id || row.hodId || '',
      isActive: row.isActive,
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({
    mutationFn: createDepartment,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); vem.close(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => updateDepartment(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); vem.close(); },
  });
  const deleteMut = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.hodId) delete payload.hodId;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'code', label: 'Code', render: (r: any) => <span className="font-medium text-navy">{r.code}</span> },
    { key: 'name', label: 'Name' },
    { key: 'isActive', label: 'Status', render: (r: any) => <Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'createdAt', label: 'Created', render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this department?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Departments</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search departments…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Department
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Department')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/*
            Fieldset auto-disables every native form control inside it when
            `disabled` is true — no per-input disabled={isView} boilerplate.
            border-0/p-0/m-0 strips the default fieldset chrome so the
            surrounding layout is unchanged.
          */}
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Code *</label><input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className={inp} placeholder="e.g. CSE" /></div>
              <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="e.g. Computer Science & Engineering" /></div>
              <div className="col-span-2">
                <label className={lbl}>
                  HOD (Faculty)
                  {!vem.isView && <Link to="/people/faculty" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}
                </label>
                <select value={form.hodId} onChange={e => setForm(f => ({ ...f, hodId: e.target.value }))} className={inp}>
                  <option value="">None</option>
                  {faculty.map((f: any) => <option key={f._id} value={f._id}>{f.person?.name || f.employeeCode || f._id}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="deptIsActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                <label htmlFor="deptIsActive" className="text-sm text-gray-700">Active</label>
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
