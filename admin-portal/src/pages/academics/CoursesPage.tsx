import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCourses, createCourse, updateCourse, deleteCourse, listRegulations, listDepartments } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const TYPES = ['theory', 'lab', 'project', 'seminar', 'audit'] as const;
const TYPE_COLOR: Record<string, string> = { theory: 'info', lab: 'warning', project: 'success', seminar: 'default', audit: 'default' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = { code: '', name: '', regulationId: '', departmentId: '', credits: '', lectureHrs: '3', tutorialHrs: '0', practicalHrs: '0', type: 'theory', isElective: false };

export default function CoursesPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [filterRegulation, setFilterRegulation] = useState('');
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['courses', page, filterRegulation, limit, search], queryFn: () => listCourses(page, limit, filterRegulation || undefined, search) });
  const { data: regsData } = useQuery({ queryKey: ['regulations', 1, 100], queryFn: () => listRegulations(1, 100) });
  const { data: deptsData } = useQuery({ queryKey: ['departments', 1, 100], queryFn: () => listDepartments(1, 100) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      code: row.code,
      name: row.name,
      regulationId: row.regulationId?._id || row.regulationId || '',
      departmentId: row.departmentId?._id || row.departmentId || '',
      credits: String(row.credits),
      lectureHrs: String(row.lectureHrs || 0),
      tutorialHrs: String(row.tutorialHrs || 0),
      practicalHrs: String(row.practicalHrs || 0),
      type: row.type,
      isElective: row.isElective,
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createCourse, onSuccess: () => { qc.invalidateQueries({ queryKey: ['courses'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateCourse(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['courses'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteCourse, onSuccess: () => { qc.invalidateQueries({ queryKey: ['courses'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, credits: Number(form.credits), lectureHrs: Number(form.lectureHrs), tutorialHrs: Number(form.tutorialHrs), practicalHrs: Number(form.practicalHrs) };
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'code', label: 'Code', render: (r: any) => <span className="font-medium text-navy">{r.code}</span> },
    { key: 'name', label: 'Name' },
    { key: 'credits', label: 'Credits', render: (r: any) => <span className="font-semibold">{r.credits}</span> },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant={TYPE_COLOR[r.type]}>{r.type}</Badge> },
    { key: 'ltp', label: 'L-T-P', render: (r: any) => `${r.lectureHrs || 0}-${r.tutorialHrs || 0}-${r.practicalHrs || 0}` },
    { key: 'isElective', label: 'Elective', render: (r: any) => r.isElective ? <Badge variant="warning">Elective</Badge> : <span className="text-gray-400 text-xs">Core</span> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this course?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Courses</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search courses…" className="w-56" />
        <div className="flex gap-3">
          <select value={filterRegulation} onChange={e => { setFilterRegulation(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Regulations</option>
            {regsData?.items?.map((r: any) => <option key={r._id} value={r._id}>{r.code}</option>)}
          </select>
          <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> New Course
          </button>
        </div>
        </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No courses match “${search}”.` : 'No courses yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Course')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Code *</label><input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className={inp} placeholder="e.g. CS201" /></div>
              <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="e.g. Data Structures" /></div>
              <div><label className={lbl}>Regulation *</label>
                <select required value={form.regulationId} onChange={e => setForm(f => ({ ...f, regulationId: e.target.value }))} className={inp}>
                  <option value="">Select...</option>
                  {regsData?.items?.map((r: any) => <option key={r._id} value={r._id}>{r.code} — {r.name}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Department *</label>
                <select required value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} className={inp}>
                  <option value="">Select...</option>
                  {deptsData?.items?.map((d: any) => <option key={d._id} value={d._id}>{d.code} — {d.name}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Credits *</label><input required type="number" min={0} value={form.credits} onChange={e => setForm(f => ({ ...f, credits: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Type *</label>
                <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Lecture Hrs (L)</label><input type="number" min={0} value={form.lectureHrs} onChange={e => setForm(f => ({ ...f, lectureHrs: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Tutorial Hrs (T)</label><input type="number" min={0} value={form.tutorialHrs} onChange={e => setForm(f => ({ ...f, tutorialHrs: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Practical Hrs (P)</label><input type="number" min={0} value={form.practicalHrs} onChange={e => setForm(f => ({ ...f, practicalHrs: e.target.value }))} className={inp} /></div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="isElective" checked={form.isElective} onChange={e => setForm(f => ({ ...f, isElective: e.target.checked }))} className="rounded" />
                <label htmlFor="isElective" className="text-sm text-gray-700">Elective Course</label>
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
