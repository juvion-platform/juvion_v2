import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listProgrammes, createProgramme, updateProgramme, deleteProgramme, listRegulations } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const LEVELS = ['UG', 'PG', 'Diploma', 'PhD'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = { code: '', name: '', level: 'UG', durationYears: '', regulationId: '', isActive: true };

export default function ProgrammesPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['programmes', page, limit, search], queryFn: () => listProgrammes(page, limit, search) });
  const { data: regsData } = useQuery({ queryKey: ['regulations', 1, 100], queryFn: () => listRegulations(1, 100) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      code: row.code,
      name: row.name,
      level: row.level,
      durationYears: String(row.durationYears),
      regulationId: row.regulationId?._id || row.regulationId || '',
      isActive: row.isActive,
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({
    mutationFn: createProgramme,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['programmes'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); vem.close(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => updateProgramme(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['programmes'] }); vem.close(); },
  });
  const deleteMut = useMutation({
    mutationFn: deleteProgramme,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['programmes'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, durationYears: Number(form.durationYears) };
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'code', label: 'Code', render: (r: any) => <span className="font-medium text-navy">{r.code}</span> },
    { key: 'name', label: 'Name' },
    { key: 'level', label: 'Level', render: (r: any) => <Badge variant="info">{r.level}</Badge> },
    { key: 'durationYears', label: 'Duration', render: (r: any) => `${r.durationYears} yrs` },
    { key: 'isActive', label: 'Status', render: (r: any) => <Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this programme?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Programmes</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search programmes…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Programme
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Programme')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Code *</label><input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className={inp} placeholder="e.g. BTECH" /></div>
              <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="e.g. Bachelor of Technology" /></div>
              <div><label className={lbl}>Level *</label>
                <select required value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} className={inp}>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Duration (Years) *</label><input required type="number" min={1} value={form.durationYears} onChange={e => setForm(f => ({ ...f, durationYears: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Regulation *</label>
                <select required value={form.regulationId} onChange={e => setForm(f => ({ ...f, regulationId: e.target.value }))} className={inp}>
                  <option value="">Select regulation...</option>
                  {regsData?.items?.map((r: any) => <option key={r._id} value={r._id}>{r.code} — {r.name}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="pgIsActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                <label htmlFor="pgIsActive" className="text-sm text-gray-700">Active</label>
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
