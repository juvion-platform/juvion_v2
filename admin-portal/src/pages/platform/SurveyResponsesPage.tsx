import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSurveyResponses, createSurveyResponse, updateSurveyResponse, deleteSurveyResponse } from '../../services/platform';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function SurveyResponsesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ surveyId: '', respondentId: '' });

  const { data, isLoading } = useQuery({ queryKey: ['survey-responses', page], queryFn: () => listSurveyResponses(page, 20) });

  const createMut = useMutation({ mutationFn: createSurveyResponse, onSuccess: () => { qc.invalidateQueries({ queryKey: ['survey-responses'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateSurveyResponse(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['survey-responses'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteSurveyResponse, onSuccess: () => { qc.invalidateQueries({ queryKey: ['survey-responses'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ surveyId: '', respondentId: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      surveyId: row.surveyId?._id || row.surveyId || '',
      respondentId: row.respondentId?._id || row.respondentId || '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, answers: [] };
    if (editing) {
      delete payload.answers;
      updateMut.mutate({ id: editing._id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const columns = [
    { key: 'surveyId', label: 'Survey', render: (r: any) => <span className="font-medium text-navy">{r.surveyId?.title || r.surveyId || '\u2014'}</span> },
    { key: 'respondentId', label: 'Respondent', render: (r: any) => r.respondentId?.name || r.respondentId || '\u2014' },
    { key: 'answers', label: 'Answers', render: (r: any) => `${r.answers?.length || 0} answers` },
    { key: 'submittedAt', label: 'Submitted', render: (r: any) => fmtDate(r.submittedAt) },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this response?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Survey Responses</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Response
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Response' : 'New Response'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Survey ID *</label><input required value={form.surveyId} onChange={e => setForm(f => ({ ...f, surveyId: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Respondent ID *</label><input required value={form.respondentId} onChange={e => setForm(f => ({ ...f, respondentId: e.target.value }))} className={inp} /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              {createMut.isPending || updateMut.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
