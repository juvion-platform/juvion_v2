import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAppraisals, createAppraisal, updateAppraisal, deleteAppraisal, listEmployees } from '../../services/hr';
import { listAcademicYears } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const STATUSES = ['initiated', 'self_review', 'reviewer_review', 'completed'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { employeeId: '', academicYearId: '', reviewerId: '', selfRating: '', reviewerRating: '', finalRating: '', status: 'initiated' };

export default function AppraisalsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['appraisals', page], queryFn: () => listAppraisals(page, 20) });
  const { data: employees } = useQuery({ queryKey: ['employees-all'], queryFn: () => listEmployees(1, 200) });
  const { data: academicYears } = useQuery({ queryKey: ['academicYears', 'all'], queryFn: () => listAcademicYears(1, 100) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      employeeId: row.employeeId?._id || row.employeeId || '',
      academicYearId: row.academicYearId?._id || row.academicYearId || '',
      reviewerId: row.reviewerId?._id || row.reviewerId || '',
      selfRating: row.selfRating != null ? String(row.selfRating) : '',
      reviewerRating: row.reviewerRating != null ? String(row.reviewerRating) : '',
      finalRating: row.finalRating != null ? String(row.finalRating) : '',
      status: row.status || 'initiated',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createAppraisal, onSuccess: () => { qc.invalidateQueries({ queryKey: ['appraisals'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateAppraisal(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['appraisals'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteAppraisal, onSuccess: () => { qc.invalidateQueries({ queryKey: ['appraisals'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (form.selfRating) payload.selfRating = Number(form.selfRating);
    else delete payload.selfRating;
    if (form.reviewerRating) payload.reviewerRating = Number(form.reviewerRating);
    else delete payload.reviewerRating;
    if (form.finalRating) payload.finalRating = Number(form.finalRating);
    else delete payload.finalRating;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { initiated: 'default', self_review: 'info', reviewer_review: 'warning', completed: 'success' };
    return <Badge variant={(map[s] || 'default') as any}>{s}</Badge>;
  };

  const columns = [
    { key: 'employeeId', label: 'Employee', render: (r: any) => <span className="font-medium text-navy">{r.employeeId?.personId?.name || r.employeeId?.employeeId || '—'}</span> },
    { key: 'reviewerId', label: 'Reviewer', render: (r: any) => r.reviewerId?.personId?.name || r.reviewerId?.employeeId || '—' },
    { key: 'academicYearId', label: 'Academic Year', render: (r: any) => r.academicYearId?.label || r.academicYearId?.code || '—' },
    { key: 'finalRating', label: 'Final Rating', render: (r: any) => r.finalRating || '—' },
    { key: 'status', label: 'Status', render: (r: any) => statusBadge(r.status) },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this appraisal?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Appraisals</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Appraisal
        </button>
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Appraisal')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Employee * {!vem.isView && <Link to="/hr/employees" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={inp}>
                  <option value="">Select employee</option>
                  {(employees?.items || []).map((e: any) => <option key={e._id} value={e._id}>{e.personId?.name || e.employeeId || e._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Academic Year * {!vem.isView && <Link to="/academics/academic-years" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))} className={inp}>
                  <option value="">Select academic year</option>
                  {(academicYears?.items || []).map((ay: any) => <option key={ay._id} value={ay._id}>{ay.label || ay.code}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Reviewer * {!vem.isView && <Link to="/hr/employees" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.reviewerId} onChange={e => setForm(f => ({ ...f, reviewerId: e.target.value }))} className={inp}>
                  <option value="">Select reviewer</option>
                  {(employees?.items || []).map((e: any) => <option key={e._id} value={e._id}>{e.personId?.name || e.employeeId || e._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Self Rating</label><input type="number" value={form.selfRating} onChange={e => setForm(f => ({ ...f, selfRating: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Reviewer Rating</label><input type="number" value={form.reviewerRating} onChange={e => setForm(f => ({ ...f, reviewerRating: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Final Rating</label><input type="number" value={form.finalRating} onChange={e => setForm(f => ({ ...f, finalRating: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
