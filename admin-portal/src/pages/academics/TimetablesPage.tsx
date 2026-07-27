import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listTimetables, createTimetable, updateTimetable, deleteTimetable, listSemesters, listSections } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';
import TimetableSlotsPanel from '../../components/academics/TimetableSlotsPanel';

const STATUSES = ['draft', 'published', 'archived'] as const;
const STATUS_COLOR: Record<string, string> = { draft: 'default', published: 'success', archived: 'info' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = { semesterId: '', sectionId: '', version: '1', status: 'draft', effectiveFrom: '' };

export default function TimetablesPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['timetables', page, limit, search], queryFn: () => listTimetables(page, limit, undefined, search) });
  const { data: semData } = useQuery({ queryKey: ['semesters', 1, 100], queryFn: () => listSemesters(1, 100) });
  const { data: secData } = useQuery({ queryKey: ['sections', 1, 100], queryFn: () => listSections(1, 100) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      semesterId: row.semesterId?._id || row.semesterId || '',
      sectionId: row.sectionId?._id || row.sectionId || '',
      version: String(row.version || 1),
      status: row.status || 'draft',
      effectiveFrom: row.effectiveFrom?.substring(0, 10) || '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createTimetable, onSuccess: () => { qc.invalidateQueries({ queryKey: ['timetables'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateTimetable(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['timetables'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteTimetable, onSuccess: () => qc.invalidateQueries({ queryKey: ['timetables'] }) });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, version: Number(form.version) };
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'sectionId', label: 'Section', render: (r: any) => <span className="font-medium text-navy">{typeof r.sectionId === 'object' ? r.sectionId.name : r.sectionId}</span> },
    { key: 'semesterId', label: 'Semester', render: (r: any) => typeof r.semesterId === 'object' ? `Sem ${r.semesterId.number}` : r.semesterId },
    { key: 'version', label: 'Version', render: (r: any) => `v${r.version || 1}` },
    { key: 'effectiveFrom', label: 'Effective From', render: (r: any) => new Date(r.effectiveFrom).toLocaleDateString() },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status]}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete timetable and all its slots?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Timetables</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search timetables…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Timetable</button>
      </div>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No timetables match “${search}”.` : 'No timetables yet.'}
      />
      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Timetable')} widthClass="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Semester *</label>
                <select required value={form.semesterId} onChange={e => setForm(f => ({ ...f, semesterId: e.target.value }))} className={inp}>
                  <option value="">Select...</option>
                  {semData?.items?.map((s: any) => <option key={s._id} value={s._id}>Sem {s.number} Year {s.year}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Section *</label>
                <select required value={form.sectionId} onChange={e => setForm(f => ({ ...f, sectionId: e.target.value }))} className={inp}>
                  <option value="">Select...</option>
                  {secData?.items?.map((s: any) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Version</label><input type="number" min={1} value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Effective From *</label><input required type="date" value={form.effectiveFrom} onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))} className={inp} /></div>
              {!vem.isCreate && (
                <div className="col-span-2"><label className={lbl}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>
          </fieldset>

          {/* Individual periods. Needs a saved timetable to attach slots to,
              so it appears on view/edit rather than during create. */}
          {vem.entity?._id && (
            <div>
              <label className={lbl}>Periods</label>
              <TimetableSlotsPanel
                timetableId={vem.entity._id}
                readOnly={form.status === 'published' || form.status === 'archived'}
              />
              {(form.status === 'published' || form.status === 'archived') && (
                <p className="mt-1 text-xs text-slate-500">
                  A {form.status} timetable is locked. Move it back to draft to change periods.
                </p>
              )}
            </div>
          )}

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
