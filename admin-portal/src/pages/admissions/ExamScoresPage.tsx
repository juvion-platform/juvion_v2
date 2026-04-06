import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listExamScores, createExamScore, listApplicants } from '../../services/admissions';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, ExternalLink } from 'lucide-react';

const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const EXAMS = ['EAMCET', 'JEE', 'ECET'] as const;

export default function ExamScoresPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ applicantId: '', examType: 'EAMCET', rank: '', score: '', year: new Date().getFullYear().toString() });

  const { data, isLoading } = useQuery({
    queryKey: ['exam-scores', page],
    queryFn: () => listExamScores(page, 20),
  });

  const { data: applicantsData } = useQuery({ queryKey: ['applicants-all'], queryFn: () => listApplicants(1, 200) });

  const createMut = useMutation({
    mutationFn: createExamScore,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam-scores'] }); setModalOpen(false); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMut.mutate({
      applicantId: form.applicantId,
      examType: form.examType,
      rank: form.rank ? Number(form.rank) : undefined,
      score: Number(form.score),
      year: Number(form.year),
    });
  }

  const columns = [
    { key: 'examType', label: 'Exam', render: (r: any) => <Badge variant="info">{r.examType}</Badge> },
    { key: 'score', label: 'Score' },
    { key: 'rank', label: 'Rank', render: (r: any) => r.rank || '—' },
    { key: 'year', label: 'Year' },
    { key: 'createdAt', label: 'Recorded', render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Entrance Exam Scores</h2>
        <button onClick={() => { setForm({ applicantId: '', examType: 'EAMCET', rank: '', score: '', year: new Date().getFullYear().toString() }); setModalOpen(true); }} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> Add Score
        </button>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Entrance Exam Score">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">
                Applicant *
                <Link to="/admissions/applicants" className={manageLink}>+ Manage <ExternalLink size={11} /></Link>
              </label>
              <select required value={form.applicantId} onChange={e => setForm(f => ({ ...f, applicantId: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select applicant...</option>
                {(applicantsData?.items || []).map((a: any) => (
                  <option key={a._id} value={a._id}>{a.name || a.email || a._id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Exam Type *</label>
              <select required value={form.examType} onChange={e => setForm(f => ({ ...f, examType: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                {EXAMS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Year *</label>
              <input required type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Score *</label>
              <input required type="number" value={form.score} onChange={e => setForm(f => ({ ...f, score: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Rank</label>
              <input type="number" value={form.rank} onChange={e => setForm(f => ({ ...f, rank: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              {createMut.isPending ? 'Saving...' : 'Add Score'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
