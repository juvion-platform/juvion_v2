import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType } from '../../services/hr';
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

const emptyForm = { name: '', code: '', maxDaysPerYear: '', isCarryForward: false, maxCarryForward: '', applicableTo: '' };

export default function LeaveTypesPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['leave-types', page, limit, search], queryFn: () => listLeaveTypes(page, limit, search) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      name: row.name || '',
      code: row.code || '',
      maxDaysPerYear: row.maxDaysPerYear != null ? String(row.maxDaysPerYear) : '',
      isCarryForward: row.isCarryForward || false,
      maxCarryForward: row.maxCarryForward != null ? String(row.maxCarryForward) : '',
      applicableTo: Array.isArray(row.applicableTo) ? row.applicableTo.join(',') : (row.applicableTo || ''),
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createLeaveType, onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-types'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateLeaveType(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-types'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteLeaveType, onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-types'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (form.maxDaysPerYear) payload.maxDaysPerYear = Number(form.maxDaysPerYear);
    else delete payload.maxDaysPerYear;
    if (form.maxCarryForward) payload.maxCarryForward = Number(form.maxCarryForward);
    else delete payload.maxCarryForward;
    if (form.applicableTo) payload.applicableTo = form.applicableTo.split(',').map((s: string) => s.trim()).filter(Boolean);
    else delete payload.applicableTo;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'code', label: 'Code' },
    { key: 'maxDaysPerYear', label: 'Max Days' },
    { key: 'isCarryForward', label: 'Carry Forward', render: (r: any) => <Badge variant={r.isCarryForward ? 'success' : 'default'}>{r.isCarryForward ? 'Yes' : 'No'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this leave type?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Leave Types</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search leave types…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Leave Type
        </button>
      </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
        emptyMessage={search ? `No leave types match “${search}”.` : 'No leave types yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Leave Type')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Code *</label><input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Max Days Per Year *</label><input required type="number" min={0} value={form.maxDaysPerYear} onChange={e => setForm(f => ({ ...f, maxDaysPerYear: e.target.value }))} className={inp} /></div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="isCarryForward" checked={form.isCarryForward} onChange={e => setForm(f => ({ ...f, isCarryForward: e.target.checked }))} className="rounded border-gray-300" />
                <label htmlFor="isCarryForward" className="text-sm font-medium text-gray-700">Carry Forward</label>
              </div>
              <div><label className={lbl}>Max Carry Forward</label><input type="number" min={0} value={form.maxCarryForward} onChange={e => setForm(f => ({ ...f, maxCarryForward: e.target.value }))} className={inp} placeholder="Optional" /></div>
              <div><label className={lbl}>Applicable To</label><input value={form.applicableTo} onChange={e => setForm(f => ({ ...f, applicableTo: e.target.value }))} className={inp} placeholder="comma-separated: teaching,non_teaching,contract,all" /></div>
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
