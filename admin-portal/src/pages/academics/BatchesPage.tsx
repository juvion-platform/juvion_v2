import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listBatches, createBatch, updateBatch, deleteBatch, listProgrammes, listRegulations } from '../../services/academics';
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

const emptyForm = { code: '', name: '', admissionYear: '', programmeId: '', regulationId: '', isActive: true };

export default function BatchesPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['batches', page, limit, search], queryFn: () => listBatches(page, limit, search) });
  const { data: progsData } = useQuery({ queryKey: ['programmes', 1, 100], queryFn: () => listProgrammes(1, 100) });
  const { data: regsData } = useQuery({ queryKey: ['regulations', 1, 100], queryFn: () => listRegulations(1, 100) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      code: row.code,
      name: row.name,
      admissionYear: String(row.admissionYear),
      programmeId: row.programmeId?._id || row.programmeId || '',
      regulationId: row.regulationId?._id || row.regulationId || '',
      isActive: row.isActive,
    }),
    onOpenCreate: () => setForm({ ...emptyForm, admissionYear: String(new Date().getFullYear()) }),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createBatch, onSuccess: () => { qc.invalidateQueries({ queryKey: ['batches'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateBatch(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['batches'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteBatch, onSuccess: () => { qc.invalidateQueries({ queryKey: ['batches'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, admissionYear: Number(form.admissionYear) };
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'code', label: 'Code', render: (r: any) => <span className="font-medium text-navy">{r.code}</span> },
    { key: 'name', label: 'Name' },
    { key: 'admissionYear', label: 'Year' },
    { key: 'isActive', label: 'Status', render: (r: any) => <Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'createdAt', label: 'Created', render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this batch?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Batches</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search batches…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Batch
        </button>
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Batch')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Code *</label><input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className={inp} placeholder="e.g. B2024" /></div>
              <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="e.g. 2024 Batch" /></div>
              <div><label className={lbl}>Admission Year *</label><input required type="number" min={2000} value={form.admissionYear} onChange={e => setForm(f => ({ ...f, admissionYear: e.target.value }))} className={inp} /></div>
              <div />
              <div><label className={lbl}>Programme *</label>
                <select required value={form.programmeId} onChange={e => setForm(f => ({ ...f, programmeId: e.target.value }))} className={inp}>
                  <option value="">Select programme...</option>
                  {progsData?.items?.map((p: any) => <option key={p._id} value={p._id}>{p.code} — {p.name}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Regulation *</label>
                <select required value={form.regulationId} onChange={e => setForm(f => ({ ...f, regulationId: e.target.value }))} className={inp}>
                  <option value="">Select regulation...</option>
                  {regsData?.items?.map((r: any) => <option key={r._id} value={r._id}>{r.code} — {r.name}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="batchIsActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                <label htmlFor="batchIsActive" className="text-sm text-gray-700">Active</label>
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
