import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSemesters, createSemester, updateSemester, deleteSemester, listAcademicYears } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const STATUS_COLOR: Record<string, string> = { upcoming: 'default', active: 'success', completed: 'info' };
const STATUSES = ['upcoming', 'active', 'completed'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = { academicYearId: '', number: '', year: '', startDate: '', endDate: '', status: 'upcoming' };

export default function SemestersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['semesters', page], queryFn: () => listSemesters(page, 20) });
  const { data: yearsData } = useQuery({ queryKey: ['academic-years', 1, 100], queryFn: () => listAcademicYears(1, 100) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      academicYearId: row.academicYearId?._id || row.academicYearId || '',
      number: String(row.number),
      year: String(row.year),
      startDate: row.startDate?.substring(0, 10) || '',
      endDate: row.endDate?.substring(0, 10) || '',
      status: row.status,
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createSemester, onSuccess: () => { qc.invalidateQueries({ queryKey: ['semesters'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateSemester(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['semesters'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteSemester, onSuccess: () => { qc.invalidateQueries({ queryKey: ['semesters'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, number: Number(form.number), year: Number(form.year) };
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'number', label: 'Sem #', render: (r: any) => <span className="font-medium text-navy">Semester {r.number}</span> },
    { key: 'year', label: 'Year', render: (r: any) => `Year ${r.year}` },
    { key: 'startDate', label: 'Start', render: (r: any) => new Date(r.startDate).toLocaleDateString() },
    { key: 'endDate', label: 'End', render: (r: any) => new Date(r.endDate).toLocaleDateString() },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status]}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this semester?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Semesters</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Semester
        </button>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView} />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Semester')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className={lbl}>Academic Year *</label>
                <select required value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))} className={inp}>
                  <option value="">Select academic year...</option>
                  {yearsData?.items?.map((y: any) => <option key={y._id} value={y._id}>{y.code} — {y.label}{y.isCurrent ? ' (Current)' : ''}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Semester Number *</label><input required type="number" min={1} max={12} value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} className={inp} placeholder="e.g. 1, 2" /></div>
              <div><label className={lbl}>Year *</label><input required type="number" min={1} max={6} value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className={inp} placeholder="e.g. 1, 2, 3, 4" /></div>
              <div><label className={lbl}>Start Date *</label><input required type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>End Date *</label><input required type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={inp} /></div>
              {!vem.isCreate && (
                <div className="col-span-2"><label className={lbl}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
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
