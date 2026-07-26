import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listExamScores, createExamScore, updateExamScore, listApplicants } from '../../services/admissions';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, ExternalLink } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const EXAMS = ['EAMCET', 'JEE', 'ECET'] as const;

const emptyForm = { applicantId: '', examType: 'EAMCET', rank: '', score: '', year: new Date().getFullYear().toString() };

export default function ExamScoresPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['exam-scores', page, limit, search],
    queryFn: () => listExamScores(page, limit, undefined, search),
  });

  const { data: applicantsData } = useQuery({ queryKey: ['applicants-all'], queryFn: () => listApplicants(1, 200) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      applicantId: row.applicantId?._id || row.applicantId || '',
      examType: row.examType || 'EAMCET',
      rank: row.rank != null ? String(row.rank) : '',
      score: row.score != null ? String(row.score) : '',
      year: row.year != null ? String(row.year) : new Date().getFullYear().toString(),
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({
    mutationFn: createExamScore,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam-scores'] }); vem.close(); },
  });

  // The backend has exposed PUT /exam-scores/:id all along; the page just
  // never called it, leaving every record permanently read-only.
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => updateExamScore(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam-scores'] }); vem.close(); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      applicantId: form.applicantId,
      examType: form.examType,
      rank: form.rank ? Number(form.rank) : undefined,
      score: Number(form.score),
      year: Number(form.year),
    };
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'examType', label: 'Exam', render: (r: any) => <Badge variant="info">{r.examType}</Badge> },
    { key: 'score', label: 'Score' },
    { key: 'rank', label: 'Rank', render: (r: any) => r.rank || '—' },
    { key: 'year', label: 'Year' },
    { key: 'createdAt', label: 'Recorded', render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
    { key: 'actions', label: '', sortable: false, render: (r: any) => (
      <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit">
        <Pencil size={15} className="text-amber-500" />
      </button>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Entrance Exam Scores</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> Add Score
        </button>
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Exam Score')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Applicant *
                  {!vem.isView && <Link to="/admissions/applicants" className={manageLink}>+ Manage <ExternalLink size={11} /></Link>}
                </label>
                <select required value={form.applicantId} onChange={e => setForm(f => ({ ...f, applicantId: e.target.value }))} className={inp}>
                  <option value="">Select applicant...</option>
                  {(applicantsData?.items || []).map((a: any) => (
                    <option key={a._id} value={a._id}>{a.name || a.email || a._id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Exam Type *</label>
                <select required value={form.examType} onChange={e => setForm(f => ({ ...f, examType: e.target.value }))} className={inp}>
                  {EXAMS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Year *</label>
                <input required type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Score *</label>
                <input required type="number" value={form.score} onChange={e => setForm(f => ({ ...f, score: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rank</label>
                <input type="number" value={form.rank} onChange={e => setForm(f => ({ ...f, rank: e.target.value }))} className={inp} />
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
                {saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Add Score'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
