import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLeaveBalances, createLeaveBalance, updateLeaveBalance, deleteLeaveBalance, listEmployees, listLeaveTypes } from '../../services/hr';
import { listAcademicYears } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function LeaveBalancesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ employeeId: '', leaveTypeId: '', academicYearId: '', entitled: '', taken: '', balance: '' });

  const { data, isLoading } = useQuery({ queryKey: ['leave-balances', page], queryFn: () => listLeaveBalances(page, 20) });
  const { data: employeesData } = useQuery({ queryKey: ['employees-all'], queryFn: () => listEmployees(1, 200) });
  const { data: leaveTypesData } = useQuery({ queryKey: ['leave-types-all'], queryFn: () => listLeaveTypes(1, 100) });
  const { data: academicYearsData } = useQuery({ queryKey: ['academicYears', 'all'], queryFn: () => listAcademicYears(1, 100) });

  const employees = employeesData?.items || [];
  const leaveTypes = leaveTypesData?.items || [];
  const academicYears = academicYearsData?.items || [];

  const createMut = useMutation({ mutationFn: createLeaveBalance, onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-balances'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateLeaveBalance(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-balances'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteLeaveBalance, onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-balances'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ employeeId: '', leaveTypeId: '', academicYearId: '', entitled: '', taken: '', balance: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      employeeId: row.employeeId?._id || row.employeeId || '',
      leaveTypeId: row.leaveTypeId?._id || row.leaveTypeId || '',
      academicYearId: row.academicYearId?._id || row.academicYearId || '',
      entitled: row.entitled != null ? String(row.entitled) : '',
      taken: row.taken != null ? String(row.taken) : '',
      balance: row.balance != null ? String(row.balance) : '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (form.entitled) payload.entitled = Number(form.entitled);
    else delete payload.entitled;
    payload.taken = form.taken ? Number(form.taken) : 0;
    if (form.balance) payload.balance = Number(form.balance);
    else delete payload.balance;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

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
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this leave balance?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Leave Balances</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Leave Balance
        </button>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Leave Balance' : 'New Leave Balance'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Employee * <Link to="/hr/employees" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={inp}>
                <option value="">Select employee...</option>
                {employees.map((emp: any) => <option key={emp._id} value={emp._id}>{employeeDisplayName(emp)}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Leave Type * <Link to="/hr/leave-types" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.leaveTypeId} onChange={e => setForm(f => ({ ...f, leaveTypeId: e.target.value }))} className={inp}>
                <option value="">Select leave type...</option>
                {leaveTypes.map((lt: any) => <option key={lt._id} value={lt._id}>{lt.name || lt.code}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Academic Year * <Link to="/academics/academic-years" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))} className={inp}>
                <option value="">Select academic year...</option>
                {academicYears.map((ay: any) => <option key={ay._id} value={ay._id}>{ay.label || ay.code}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Entitled *</label><input required type="number" min={0} value={form.entitled} onChange={e => setForm(f => ({ ...f, entitled: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Taken</label><input type="number" min={0} value={form.taken} onChange={e => setForm(f => ({ ...f, taken: e.target.value }))} className={inp} placeholder="Default: 0" /></div>
            <div><label className={lbl}>Balance *</label><input required type="number" min={0} value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} className={inp} /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              {createMut.isPending || updateMut.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
