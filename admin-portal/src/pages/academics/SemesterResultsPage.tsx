import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSemesterResults, createSemesterResult, updateSemesterResult, deleteSemesterResult, listSemesters } from '../../services/academics';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const RESULTS = ['pass', 'fail', 'detained'] as const;
const RESULT_COLOR: Record<string, string> = { pass: 'success', fail: 'danger', detained: 'warning' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { studentId: '', semesterId: '', sgpa: '0', cgpa: '0', totalCreditsEarned: '0', totalCreditsRegistered: '0', backlogs: '0', result: 'pass' };

export default function SemesterResultsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['semester-results', page, limit, search], queryFn: () => listSemesterResults(page, limit, undefined, search) });
  const { data: semData } = useQuery({ queryKey: ['semesters', 1, 100], queryFn: () => listSemesters(1, 100) });
  const { data: studentsData } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 200) });
  const students = studentsData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      studentId: row.studentId?._id || row.studentId || '',
      semesterId: row.semesterId?._id || row.semesterId || '',
      sgpa: String(row.sgpa),
      cgpa: String(row.cgpa),
      totalCreditsEarned: String(row.totalCreditsEarned),
      totalCreditsRegistered: String(row.totalCreditsRegistered),
      backlogs: String(row.backlogs),
      result: row.result,
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createSemesterResult, onSuccess: () => { qc.invalidateQueries({ queryKey: ['semester-results'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateSemesterResult(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['semester-results'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteSemesterResult, onSuccess: () => qc.invalidateQueries({ queryKey: ['semester-results'] }) });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, sgpa: Number(form.sgpa), cgpa: Number(form.cgpa), totalCreditsEarned: Number(form.totalCreditsEarned), totalCreditsRegistered: Number(form.totalCreditsRegistered), backlogs: Number(form.backlogs) };
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{typeof r.studentId === 'object' ? r.studentId.personId?.name || r.studentId.rollNumber || r.studentId._id : r.studentId}</span> },
    { key: 'semesterId', label: 'Semester', render: (r: any) => typeof r.semesterId === 'object' ? `Sem ${r.semesterId.number}` : r.semesterId },
    { key: 'sgpa', label: 'SGPA', render: (r: any) => <span className="font-bold">{r.sgpa?.toFixed(2)}</span> },
    { key: 'cgpa', label: 'CGPA', render: (r: any) => <span className="font-bold">{r.cgpa?.toFixed(2)}</span> },
    { key: 'credits', label: 'Credits', render: (r: any) => `${r.totalCreditsEarned}/${r.totalCreditsRegistered}` },
    { key: 'backlogs', label: 'Backlogs' },
    { key: 'result', label: 'Result', render: (r: any) => <Badge variant={RESULT_COLOR[r.result]}>{r.result}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Semester Results</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search semester results…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Result</button>
      </div>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No semester results match “${search}”.` : 'No semester results yet.'}
      />
      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Semester Result')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Student * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student...</option>
                  {students.map((s: any) => <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Semester *</label>
                <select required value={form.semesterId} onChange={e => setForm(f => ({ ...f, semesterId: e.target.value }))} className={inp}>
                  <option value="">Select...</option>
                  {semData?.items?.map((s: any) => <option key={s._id} value={s._id}>Sem {s.number} Year {s.year}</option>)}
                </select>
              </div>
              <div><label className={lbl}>SGPA *</label><input required type="number" min={0} max={10} step="0.01" value={form.sgpa} onChange={e => setForm(f => ({ ...f, sgpa: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>CGPA *</label><input required type="number" min={0} max={10} step="0.01" value={form.cgpa} onChange={e => setForm(f => ({ ...f, cgpa: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Credits Earned *</label><input required type="number" min={0} value={form.totalCreditsEarned} onChange={e => setForm(f => ({ ...f, totalCreditsEarned: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Credits Registered *</label><input required type="number" min={0} value={form.totalCreditsRegistered} onChange={e => setForm(f => ({ ...f, totalCreditsRegistered: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Backlogs *</label><input required type="number" min={0} value={form.backlogs} onChange={e => setForm(f => ({ ...f, backlogs: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Result *</label>
                <select required value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))} className={inp}>
                  {RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
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
