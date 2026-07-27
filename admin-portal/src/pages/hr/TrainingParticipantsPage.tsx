import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listTrainingParticipants, createTrainingParticipant, updateTrainingParticipant, deleteTrainingParticipant, listEmployees, listTrainings } from '../../services/hr';
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

const STATUSES = ['nominated', 'confirmed', 'attended', 'absent'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { trainingId: '', employeeId: '', status: 'nominated', feedbackRating: '', certificateIssued: false };

export default function TrainingParticipantsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['training-participants', page, limit, search], queryFn: () => listTrainingParticipants(page, limit, undefined, search) });
  const { data: employees } = useQuery({ queryKey: ['employees-all'], queryFn: () => listEmployees(1, 200) });
  const { data: trainings } = useQuery({ queryKey: ['trainings-all'], queryFn: () => listTrainings(1, 100) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      trainingId: row.trainingId?._id || row.trainingId || '',
      employeeId: row.employeeId?._id || row.employeeId || '',
      status: row.status || 'nominated',
      feedbackRating: row.feedbackRating != null ? String(row.feedbackRating) : '',
      certificateIssued: row.certificateIssued ?? false,
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createTrainingParticipant, onSuccess: () => { qc.invalidateQueries({ queryKey: ['training-participants'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateTrainingParticipant(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['training-participants'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteTrainingParticipant, onSuccess: () => { qc.invalidateQueries({ queryKey: ['training-participants'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (form.feedbackRating) payload.feedbackRating = Number(form.feedbackRating);
    else delete payload.feedbackRating;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { nominated: 'default', confirmed: 'info', attended: 'success', absent: 'danger' };
    return <Badge variant={(map[s] || 'default') as any}>{s}</Badge>;
  };

  const columns = [
    { key: 'trainingId', label: 'Training', render: (r: any) => <span className="font-medium text-navy">{r.trainingId?.title || '—'}</span> },
    { key: 'employeeId', label: 'Employee', render: (r: any) => r.employeeId?.personId?.name || r.employeeId?.employeeId || '—' },
    { key: 'status', label: 'Status', render: (r: any) => statusBadge(r.status) },
    { key: 'certificateIssued', label: 'Certificate', render: (r: any) => <Badge variant={r.certificateIssued ? 'success' : 'default'}>{r.certificateIssued ? 'Yes' : 'No'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this participant?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Training Participants</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search training participants…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Participant
        </button>
      </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
        emptyMessage={search ? `No training participants match “${search}”.` : 'No training participants yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Participant')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Training * {!vem.isView && <Link to="/hr/trainings" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.trainingId} onChange={e => setForm(f => ({ ...f, trainingId: e.target.value }))} className={inp}>
                  <option value="">Select training</option>
                  {(trainings?.items || []).map((t: any) => <option key={t._id} value={t._id}>{t.title}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Employee * {!vem.isView && <Link to="/hr/employees" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={inp}>
                  <option value="">Select employee</option>
                  {(employees?.items || []).map((e: any) => <option key={e._id} value={e._id}>{e.personId?.name || e.employeeId || e._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Feedback Rating (1-5)</label><input type="number" min={1} max={5} value={form.feedbackRating} onChange={e => setForm(f => ({ ...f, feedbackRating: e.target.value }))} className={inp} /></div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="tpCertIssued" checked={form.certificateIssued} onChange={e => setForm(f => ({ ...f, certificateIssued: e.target.checked }))} className="rounded" />
                <label htmlFor="tpCertIssued" className="text-sm text-gray-700">Certificate Issued</label>
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
