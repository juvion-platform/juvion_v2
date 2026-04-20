import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listTrainingAttendance, createTrainingAttendance, updateTrainingAttendance, deleteTrainingAttendance, listPlacementTrainings } from '../../services/placement';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { trainingId: '', studentId: '', attended: false };

export default function TrainingAttendancePage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['training-attendance', page], queryFn: () => listTrainingAttendance(page, 20) });
  const { data: trainings } = useQuery({ queryKey: ['placement-trainings-all'], queryFn: () => listPlacementTrainings(1, 200) });
  const { data: students } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 200) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      trainingId: row.trainingId?._id || row.trainingId || '',
      studentId: row.studentId?._id || row.studentId || '',
      attended: row.attended ?? false,
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createTrainingAttendance, onSuccess: () => { qc.invalidateQueries({ queryKey: ['training-attendance'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateTrainingAttendance(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['training-attendance'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteTrainingAttendance, onSuccess: () => { qc.invalidateQueries({ queryKey: ['training-attendance'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: form });
    else createMut.mutate(form);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.personId?.name || r.studentId?.rollNumber || '--' },
    { key: 'trainingId', label: 'Training', render: (r: any) => r.trainingId?.title || '--' },
    { key: 'attended', label: 'Attended', render: (r: any) => <Badge variant={r.attended ? 'success' : 'danger'}>{r.attended ? 'Yes' : 'No'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this record?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Training Attendance</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Record</button>
      </div>
      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
      />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Attendance')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Training * {!vem.isView && <Link to="/placement/trainings" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.trainingId} onChange={e => setForm(f => ({ ...f, trainingId: e.target.value }))} className={inp}>
                  <option value="">Select training</option>
                  {(trainings?.items || []).map((t: any) => <option key={t._id} value={t._id}>{t.title}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Student * {!vem.isView && <Link to="/people/students" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student</option>
                  {(students?.items || []).map((s: any) => <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="taAttended" checked={form.attended} onChange={e => setForm(f => ({ ...f, attended: e.target.checked }))} className="rounded" />
                <label htmlFor="taAttended" className="text-sm text-gray-700">Attended</label>
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
