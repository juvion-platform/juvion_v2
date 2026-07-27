import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listRoundResults, createRoundResult, updateRoundResult, deleteRoundResult, listPlacementRounds } from '../../services/placement';
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

const RESULTS = ['pass', 'fail', 'absent'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { roundId: '', studentId: '', result: 'pass', score: '', remarks: '' };

export default function RoundResultsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['round-results', page, limit, search], queryFn: () => listRoundResults(page, limit, undefined, search) });
  const { data: rounds } = useQuery({ queryKey: ['placement-rounds-all'], queryFn: () => listPlacementRounds(1, 200) });
  const { data: students } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 200) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      roundId: row.roundId?._id || row.roundId || '',
      studentId: row.studentId?._id || row.studentId || '',
      result: row.result || 'pass',
      score: row.score != null ? String(row.score) : '',
      remarks: row.remarks || '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createRoundResult, onSuccess: () => { qc.invalidateQueries({ queryKey: ['round-results'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateRoundResult(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['round-results'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteRoundResult, onSuccess: () => { qc.invalidateQueries({ queryKey: ['round-results'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (form.score) payload.score = Number(form.score);
    else delete payload.score;
    if (!payload.remarks) delete payload.remarks;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const resultVariant: Record<string, string> = { pass: 'success', fail: 'danger', absent: 'warning' };

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.personId?.name || r.studentId?.rollNumber || '--' },
    { key: 'roundId', label: 'Round', render: (r: any) => r.roundId?.name || '--' },
    { key: 'result', label: 'Result', render: (r: any) => <Badge variant={resultVariant[r.result] || 'default'}>{r.result}</Badge> },
    { key: 'score', label: 'Score', render: (r: any) => r.score != null ? r.score : '--' },
    { key: 'remarks', label: 'Remarks', render: (r: any) => r.remarks || '--' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this result?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Round Results</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search round results…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Result</button>
      </div>
      </div>
      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
        emptyMessage={search ? `No round results match “${search}”.` : 'No round results yet.'}
      />
      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Result')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Round * {!vem.isView && <Link to="/placement/rounds" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.roundId} onChange={e => setForm(f => ({ ...f, roundId: e.target.value }))} className={inp}>
                  <option value="">Select round</option>
                  {(rounds?.items || []).map((r: any) => <option key={r._id} value={r._id}>{r.name}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Student * {!vem.isView && <Link to="/people/students" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student</option>
                  {(students?.items || []).map((s: any) => <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Result *</label>
                <select required value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))} className={inp}>
                  {RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Score</label><input type="number" value={form.score} onChange={e => setForm(f => ({ ...f, score: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Remarks</label><textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className={inp} rows={2} /></div>
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
