import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listInternalAssessments, createInternalAssessment, updateInternalAssessment, deleteInternalAssessment, listCourseOfferings } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const TYPES = ['mid1', 'mid2', 'assignment', 'quiz', 'seminar', 'lab_internal'] as const;
const STATUSES = ['scheduled', 'conducted', 'marks_entered', 'finalized'] as const;
const STATUS_COLOR: Record<string, string> = { scheduled: 'default', conducted: 'info', marks_entered: 'warning', finalized: 'success' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = { courseOfferingId: '', name: '', type: 'mid1', maxMarks: '100', weightage: '20', date: '', status: 'scheduled' };

export default function InternalAssessmentsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['internal-assessments', page, limit, search], queryFn: () => listInternalAssessments(page, limit, undefined, search) });
  const { data: offeringsData } = useQuery({ queryKey: ['offerings', 1, 200], queryFn: () => listCourseOfferings(1, 200) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      courseOfferingId: row.courseOfferingId?._id || row.courseOfferingId || '',
      name: row.name,
      type: row.type,
      maxMarks: String(row.maxMarks),
      weightage: String(row.weightage),
      date: row.date?.substring(0, 10) || '',
      status: row.status || 'scheduled',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createInternalAssessment, onSuccess: () => { qc.invalidateQueries({ queryKey: ['internal-assessments'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateInternalAssessment(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['internal-assessments'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteInternalAssessment, onSuccess: () => qc.invalidateQueries({ queryKey: ['internal-assessments'] }) });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, maxMarks: Number(form.maxMarks), weightage: Number(form.weightage) };
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'name', label: 'Assessment', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant="info">{r.type}</Badge> },
    { key: 'courseOfferingId', label: 'Course', render: (r: any) => {
      if (typeof r.courseOfferingId === 'object' && r.courseOfferingId?.courseId) {
        const c = r.courseOfferingId.courseId;
        return typeof c === 'object' ? `${c.code}` : c;
      }
      return r.courseOfferingId;
    }},
    { key: 'maxMarks', label: 'Max Marks' },
    { key: 'weightage', label: 'Weightage', render: (r: any) => `${r.weightage}%` },
    { key: 'date', label: 'Date', render: (r: any) => r.date ? new Date(r.date).toLocaleDateString() : '—' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status]}>{r.status?.replace('_', ' ')}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete assessment and all marks?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Internal Assessments</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search internal assessments…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Assessment</button>
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
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Internal Assessment')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className={lbl}>Course Offering *</label>
                <select required value={form.courseOfferingId} onChange={e => setForm(f => ({ ...f, courseOfferingId: e.target.value }))} className={inp}>
                  <option value="">Select...</option>
                  {offeringsData?.items?.map((o: any) => <option key={o._id} value={o._id}>{typeof o.courseId === 'object' ? `${o.courseId.code} — ${o.courseId.name}` : o._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="e.g. Mid-1 Exam" /></div>
              <div><label className={lbl}>Type *</label>
                <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                  {TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Max Marks *</label><input required type="number" min={0} value={form.maxMarks} onChange={e => setForm(f => ({ ...f, maxMarks: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Weightage (%) *</label><input required type="number" min={0} max={100} value={form.weightage} onChange={e => setForm(f => ({ ...f, weightage: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Date</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
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
