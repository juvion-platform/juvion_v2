import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLeaveBalances, createLeaveBalance, updateLeaveBalance, deleteLeaveBalance, listEmployees, listLeaveTypes } from '../../services/hr';
import { listAcademicYears } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
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

const emptyForm = { employeeId: '', leaveTypeId: '', academicYearId: '', entitled: '', taken: '', balance: '' };

export default function LeaveBalancesPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['leave-balances', page, limit, search], queryFn: () => listLeaveBalances(page, limit, undefined, undefined, search) });
  const { data: employeesData } = useQuery({ queryKey: ['employees-all'], queryFn: () => listEmployees(1, 200) });
  const { data: leaveTypesData } = useQuery({ queryKey: ['leave-types-all'], queryFn: () => listLeaveTypes(1, 100) });
  const { data: academicYearsData } = useQuery({ queryKey: ['academicYears', 'all'], queryFn: () => listAcademicYears(1, 100) });

  const employees = employeesData?.items || [];
  const leaveTypes = leaveTypesData?.items || [];
  const academicYears = academicYearsData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      employeeId: row.employeeId?._id || row.employeeId || '',
      leaveTypeId: row.leaveTypeId?._id || row.leaveTypeId || '',
      academicYearId: row.academicYearId?._id || row.academicYearId || '',
      entitled: row.entitled != null ? String(row.entitled) : '',
      taken: row.taken != null ? String(row.taken) : '',
      balance: row.balance != null ? String(row.balance) : '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createLeaveBalance, onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-balances'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateLeaveBalance(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-balances'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteLeaveBalance, onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-balances'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (form.entitled) payload.entitled = Number(form.entitled);
    else delete payload.entitled;
    payload.taken = form.taken ? Number(form.taken) : 0;
    if (form.balance) payload.balance = Number(form.balance);
    else delete payload.balance;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  function employeeDisplayName(emp: any): string {
    return emp.personId?.name || emp.employeeId || emp._id;
  }

  const columns = [
    { key: 'employeeId', label: 'Employee', render: (r: any) => <span className="font-medium text-navy">{r.employeeId?.personId?.name || r.employeeId?.employeeId || '\u2014'}</span> },
    { key: 'leaveTypeId', label: 'Leave Type', render: (r: any) => r.leaveTypeId?.name || '\u2014' },
    { key: 'academicYearId', label: 'Academic Year', render: (r: any) => r.academicYearId?.label || r.academicYearId?.code || '\u2014' },
    { key: 'entitled', label: 'Entitled' },
    { key: 'taken', label: 'Taken' },
    { key: 'balance', label: 'Balance' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this leave balance?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Leave Balances</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search leave balances…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Leave Balance
        </button>
      </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
        emptyMessage={search ? `No leave balances match “${search}”.` : 'No leave balances yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Leave Balance')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Employee * {!vem.isView && <Link to="/hr/employees" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={inp}>
                  <option value="">Select employee...</option>
                  {employees.map((emp: any) => <option key={emp._id} value={emp._id}>{employeeDisplayName(emp)}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Leave Type * {!vem.isView && <Link to="/hr/leave-types" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.leaveTypeId} onChange={e => setForm(f => ({ ...f, leaveTypeId: e.target.value }))} className={inp}>
                  <option value="">Select leave type...</option>
                  {leaveTypes.map((lt: any) => <option key={lt._id} value={lt._id}>{lt.name || lt.code}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Academic Year * {!vem.isView && <Link to="/academics/academic-years" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))} className={inp}>
                  <option value="">Select academic year...</option>
                  {academicYears.map((ay: any) => <option key={ay._id} value={ay._id}>{ay.label || ay.code}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Entitled *</label><input required type="number" min={0} value={form.entitled} onChange={e => setForm(f => ({ ...f, entitled: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Taken</label><input type="number" min={0} value={form.taken} onChange={e => setForm(f => ({ ...f, taken: e.target.value }))} className={inp} placeholder="Default: 0" /></div>
              <div><label className={lbl}>Balance *</label><input required type="number" min={0} value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} className={inp} /></div>
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
