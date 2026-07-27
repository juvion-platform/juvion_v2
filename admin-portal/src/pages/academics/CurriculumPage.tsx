import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCurriculumMaps, createCurriculumMap, deleteCurriculumMap, listRegulations, listProgrammes, listBranches, listCourses } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = { regulationId: '', programmeId: '', branchId: '', semester: '', courseId: '', isElective: false, electiveGroup: '' };

export default function CurriculumPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [filterBranch, setFilterBranch] = useState('');
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['curriculum', page, filterBranch, limit, search], queryFn: () => listCurriculumMaps(page, limit, filterBranch || undefined, undefined, search) });
  const { data: regsData } = useQuery({ queryKey: ['regulations', 1, 100], queryFn: () => listRegulations(1, 100) });
  const { data: progsData } = useQuery({ queryKey: ['programmes', 1, 100], queryFn: () => listProgrammes(1, 100) });
  const { data: branchData } = useQuery({ queryKey: ['branches', 1, 100], queryFn: () => listBranches(1, 100) });
  const { data: coursesData } = useQuery({ queryKey: ['courses', 1, 200], queryFn: () => listCourses(1, 200) });

  // Non-standard: CurriculumMap has no update endpoint. View mode is supported
  // via row click; edit mode is never reachable (no pencil button), so the
  // switchToEdit path is effectively unused.
  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      regulationId: row.regulationId?._id || row.regulationId || '',
      programmeId: row.programmeId?._id || row.programmeId || '',
      branchId: row.branchId?._id || row.branchId || '',
      semester: String(row.semester || ''),
      courseId: row.courseId?._id || row.courseId || '',
      isElective: !!row.isElective,
      electiveGroup: row.electiveGroup || '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createCurriculumMap, onSuccess: () => { qc.invalidateQueries({ queryKey: ['curriculum'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteCurriculumMap, onSuccess: () => { qc.invalidateQueries({ queryKey: ['curriculum'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, semester: Number(form.semester) };
    if (!payload.electiveGroup) delete payload.electiveGroup;
    createMut.mutate(payload);
  }

  const saving = createMut.isPending;

  const columns = [
    { key: 'semester', label: 'Semester', render: (r: any) => <span className="font-medium text-navy">Sem {r.semester}</span> },
    { key: 'courseId', label: 'Course', render: (r: any) => typeof r.courseId === 'object' ? `${r.courseId.code} — ${r.courseId.name}` : r.courseId },
    { key: 'isElective', label: 'Type', render: (r: any) => r.isElective ? <Badge variant="warning">Elective</Badge> : <Badge variant="info">Core</Badge> },
    { key: 'electiveGroup', label: 'Elective Group', render: (r: any) => r.electiveGroup || '—' },
    { key: 'actions', label: '', render: (r: any) => (
      <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Remove this mapping?', tone: 'danger', confirmLabel: 'Remove' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Curriculum Map</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search curriculum map…" className="w-56" />
        <div className="flex gap-3">
          <select value={filterBranch} onChange={e => { setFilterBranch(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Branches</option>
            {branchData?.items?.map((b: any) => <option key={b._id} value={b._id}>{b.code}</option>)}
          </select>
          <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> Map Course
          </button>
        </div>
        </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No curriculum map match “${search}”.` : 'No curriculum map yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.isCreate ? 'Map Course to Curriculum' : 'Curriculum Mapping Details'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Regulation *</label>
                <select required value={form.regulationId} onChange={e => setForm(f => ({ ...f, regulationId: e.target.value }))} className={inp}>
                  <option value="">Select...</option>
                  {regsData?.items?.map((r: any) => <option key={r._id} value={r._id}>{r.code}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Programme *</label>
                <select required value={form.programmeId} onChange={e => setForm(f => ({ ...f, programmeId: e.target.value }))} className={inp}>
                  <option value="">Select...</option>
                  {progsData?.items?.map((p: any) => <option key={p._id} value={p._id}>{p.code}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Branch *</label>
                <select required value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))} className={inp}>
                  <option value="">Select...</option>
                  {branchData?.items?.map((b: any) => <option key={b._id} value={b._id}>{b.code} — {b.name}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Semester # *</label><input required type="number" min={1} max={12} value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Course *</label>
                <select required value={form.courseId} onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))} className={inp}>
                  <option value="">Select course...</option>
                  {coursesData?.items?.map((c: any) => <option key={c._id} value={c._id}>{c.code} — {c.name} ({c.credits} cr)</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="cmIsElective" checked={form.isElective} onChange={e => setForm(f => ({ ...f, isElective: e.target.checked }))} className="rounded" />
                <label htmlFor="cmIsElective" className="text-sm text-gray-700">Elective</label>
              </div>
              {form.isElective && (
                <div><label className={lbl}>Elective Group</label><input value={form.electiveGroup} onChange={e => setForm(f => ({ ...f, electiveGroup: e.target.value }))} className={inp} placeholder="e.g. PE-I, OE-II" /></div>
              )}
            </div>
          </fieldset>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={vem.close} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
              {vem.isView ? 'Close' : 'Cancel'}
            </button>
            {!vem.isView && (
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Mapping'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
