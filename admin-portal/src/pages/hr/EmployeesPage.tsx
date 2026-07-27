import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listEmployees, createEmployee, updateEmployee, deleteEmployee } from '../../services/hr';
import { listDepartments } from '../../services/academics';
import { listPersons } from '../../services/people';
import EntityPicker from '../../components/ui/EntityPicker';
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

const EMPLOYEE_TYPES = ['teaching', 'non_teaching', 'contract', 'visiting', 'adjunct'] as const;
const STATUSES = ['active', 'on_leave', 'resigned', 'retired', 'terminated'] as const;
const STATUS_COLOR: Record<string, string> = { active: 'success', on_leave: 'warning', resigned: 'default', retired: 'info', terminated: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { personId: '', employeeId: '', departmentId: '', designation: '', employeeType: 'teaching', joiningDate: '', reportingToId: '', status: 'active' };

export default function EmployeesPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['employees', page, limit, search], queryFn: () => listEmployees(page, limit, undefined, undefined, search) });
  const { data: departments } = useQuery({ queryKey: ['departments', 'all'], queryFn: () => listDepartments(1, 200) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      personId: row.personId?._id || row.personId || '',
      employeeId: row.employeeId || '',
      departmentId: row.departmentId?._id || row.departmentId || '',
      designation: row.designation || '',
      employeeType: row.employeeType || 'teaching',
      joiningDate: row.joiningDate ? row.joiningDate.slice(0, 10) : '',
      reportingToId: row.reportingToId?._id || row.reportingToId || '',
      status: row.status || 'active',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createEmployee, onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateEmployee(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteEmployee, onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.reportingToId) delete payload.reportingToId;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'personId', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.personId?.name || r.employeeId}</span> },
    { key: 'departmentId', label: 'Department', render: (r: any) => r.departmentId?.name || '—' },
    { key: 'designation', label: 'Designation' },
    { key: 'employeeType', label: 'Type', render: (r: any) => <Badge variant="info">{r.employeeType}</Badge> },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this employee?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Employees</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search employees…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Employee
        </button>
      </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
        emptyMessage={search ? `No employees match “${search}”.` : 'No employees yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Employee')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl} htmlFor="employee-person">
                  Person * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}
                </label>
                <EntityPicker
                  id="employee-person"
                  required
                  disabled={vem.isView}
                  queryKey={['persons', 'picker']}
                  fetcher={(q) => listPersons(1, 20, q || undefined)}
                  value={form.personId}
                  onChange={(v) => setForm(f => ({ ...f, personId: v }))}
                  getId={(p: any) => p._id}
                  getLabel={(p: any) => p.name || p._id}
                  getHint={(p: any) => [p.phone, p.email].filter(Boolean).join(' · ') || undefined}
                  fallbackLabel={vem.entity?.personId?.name}
                  placeholder="Search people by name, phone or email"
                />
              </div>
              <div><label className={lbl}>Employee ID *</label><input required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={inp} /></div>
              <div>
                <label className={lbl}>Department * {!vem.isView && <Link to="/academics/departments" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} className={inp}>
                  <option value="">Select department</option>
                  {(departments?.items || []).map((d: any) => (
                    <option key={d._id} value={d._id}>{d.name || d._id}</option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Designation *</label><input required value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Employee Type *</label>
                <select required value={form.employeeType} onChange={e => setForm(f => ({ ...f, employeeType: e.target.value }))} className={inp}>
                  {EMPLOYEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Joining Date *</label><input required type="date" value={form.joiningDate} onChange={e => setForm(f => ({ ...f, joiningDate: e.target.value }))} className={inp} /></div>
              <div>
                <label className={lbl} htmlFor="employee-reporting-to">Reporting To</label>
                <EntityPicker
                  id="employee-reporting-to"
                  disabled={vem.isView}
                  queryKey={['employees', 'picker']}
                  fetcher={(q) => listEmployees(1, 20, undefined, undefined, q || undefined)}
                  value={form.reportingToId}
                  onChange={(v) => setForm(f => ({ ...f, reportingToId: v }))}
                  getId={(e: any) => e._id}
                  getLabel={(e: any) => e.personId?.name || e.employeeId || e._id}
                  getHint={(e: any) => [e.employeeId, e.designation].filter(Boolean).join(' · ') || undefined}
                  fallbackLabel={vem.entity?.reportingToId?.personId?.name}
                  placeholder="Search employees"
                />
              </div>
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
