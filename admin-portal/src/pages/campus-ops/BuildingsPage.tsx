import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listBuildings, createBuilding, updateBuilding, deleteBuilding } from '../../services/campus-ops';
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

const emptyForm = { name: '', code: '', floors: '', totalRooms: '', location: '', isActive: true };

export default function BuildingsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['buildings', page, limit, search], queryFn: () => listBuildings(page, limit, search) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({ name: row.name || '', code: row.code || '', floors: String(row.floors ?? ''), totalRooms: String(row.totalRooms ?? ''), location: row.location || '', isActive: row.isActive !== false }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createBuilding, onSuccess: () => { qc.invalidateQueries({ queryKey: ['buildings'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateBuilding(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['buildings'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteBuilding, onSuccess: () => { qc.invalidateQueries({ queryKey: ['buildings'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, floors: Number(form.floors), totalRooms: Number(form.totalRooms) };
    if (!payload.location) delete payload.location;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'code', label: 'Code' },
    { key: 'floors', label: 'Floors' },
    { key: 'totalRooms', label: 'Rooms' },
    { key: 'location', label: 'Location', render: (r: any) => r.location || '\u2014' },
    { key: 'isActive', label: 'Status', render: (r: any) => <Badge variant={r.isActive !== false ? 'success' : 'default'}>{r.isActive !== false ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this building?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Buildings</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search buildings…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} /> New Building</button>
      </div>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView} />
      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Building')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Code *</label><input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Floors *</label><input required type="number" min={0} value={form.floors} onChange={e => setForm(f => ({ ...f, floors: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Total Rooms *</label><input required type="number" min={0} value={form.totalRooms} onChange={e => setForm(f => ({ ...f, totalRooms: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Location</label><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Active</label><select value={String(form.isActive)} onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'true' }))} className={inp}><option value="true">Yes</option><option value="false">No</option></select></div>
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
