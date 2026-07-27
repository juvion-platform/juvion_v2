import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAccreditationBodies, listAccreditationCycles, createAccreditationCycle, updateAccreditationCycle, deleteAccreditationCycle } from '../../services/compliance';
import DataTable from '../../components/ui/DataTable';
import EntityPicker from '../../components/ui/EntityPicker';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const STATUSES = ['preparing', 'applied', 'visit_scheduled', 'visited', 'accredited', 'expired'] as const;
const STATUS_COLOR: Record<string, string> = { preparing: 'default', applied: 'info', visit_scheduled: 'warning', visited: 'info', accredited: 'success', expired: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = {
  bodyId: '', cycle: 1, applicationDate: '', visitDate: '',
  grade: '', validFrom: '', validTo: '', status: 'preparing' as string,
};

export default function AccreditationCyclesPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['accreditation-cycles', page, limit, search], queryFn: () => listAccreditationCycles(page, limit, undefined, undefined, search) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      bodyId: row.bodyId?._id || row.bodyId || '',
      cycle: row.cycle || 1,
      applicationDate: row.applicationDate?.slice(0, 10) || '',
      visitDate: row.visitDate?.slice(0, 10) || '',
      grade: row.grade || '',
      validFrom: row.validFrom?.slice(0, 10) || '',
      validTo: row.validTo?.slice(0, 10) || '',
      status: row.status || 'preparing',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createAccreditationCycle, onSuccess: () => { qc.invalidateQueries({ queryKey: ['accreditation-cycles'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateAccreditationCycle(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['accreditation-cycles'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteAccreditationCycle, onSuccess: () => { qc.invalidateQueries({ queryKey: ['accreditation-cycles'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, cycle: Number(form.cycle) };
    if (!form.applicationDate) delete payload.applicationDate;
    if (!form.visitDate) delete payload.visitDate;
    if (!form.grade) delete payload.grade;
    if (!form.validFrom) delete payload.validFrom;
    if (!form.validTo) delete payload.validTo;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'body', label: 'Body', render: (r: any) => <span className="font-medium text-navy">{r.bodyId?.acronym || r.bodyId || '\u2014'}</span> },
    { key: 'cycle', label: 'Cycle', render: (r: any) => <span className="font-semibold">{r.cycle}</span> },
    { key: 'grade', label: 'Grade', render: (r: any) => r.grade ? <Badge variant="info">{r.grade}</Badge> : <span className="text-gray-400">&mdash;</span> },
    { key: 'validTo', label: 'Valid To', render: (r: any) => r.validTo ? new Date(r.validTo).toLocaleDateString() : '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this cycle?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Accreditation Cycles</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search accreditation cycles…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Cycle
        </button>
      </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No accreditation cycles match “${search}”.` : 'No accreditation cycles yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Cycle')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl} htmlFor="cycle-body">Accreditation Body *</label>
                <EntityPicker
                  id="cycle-body"
                  required
                  disabled={vem.isView}
                  queryKey={['accreditation-bodies', 'picker']}
                  fetcher={(q) => listAccreditationBodies(1, 20, q || undefined)}
                  value={form.bodyId}
                  onChange={(v) => setForm(f => ({ ...f, bodyId: v }))}
                  getId={(x: any) => x._id}
                  getLabel={(b: any) => b.name || b.code || b._id}
                  getHint={(b: any) => b.code || undefined}
                  fallbackLabel={vem.entity?.bodyId?.name}
                  placeholder="Search accreditation body"
                />
              </div>
              <div><label className={lbl}>Cycle # *</label>
                <input required type="number" min={1} value={form.cycle} onChange={e => setForm(f => ({ ...f, cycle: Number(e.target.value) }))} className={inp} />
              </div>
              <div><label className={lbl}>Application Date</label>
                <input type="date" value={form.applicationDate} onChange={e => setForm(f => ({ ...f, applicationDate: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Visit Date</label>
                <input type="date" value={form.visitDate} onChange={e => setForm(f => ({ ...f, visitDate: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Grade</label>
                <input value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} className={inp} placeholder="e.g. A++, A+, A, B++" />
              </div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Valid From</label>
                <input type="date" value={form.validFrom} onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Valid To</label>
                <input type="date" value={form.validTo} onChange={e => setForm(f => ({ ...f, validTo: e.target.value }))} className={inp} />
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
