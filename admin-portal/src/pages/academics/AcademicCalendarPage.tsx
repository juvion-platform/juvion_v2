import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAcademicCalendars, createAcademicCalendar, updateAcademicCalendar, deleteAcademicCalendar, listAcademicYears } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const EVENT_TYPES = ['instruction', 'exam', 'holiday', 'event', 'registration', 'result'] as const;
const EVENT_COLOR: Record<string, string> = { instruction: 'info', exam: 'warning', holiday: 'success', event: 'default', registration: 'info', result: 'success' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = { academicYearId: '', title: '', eventType: 'instruction', startDate: '', endDate: '', description: '', isHoliday: false };

export default function AcademicCalendarPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['academic-calendar', page], queryFn: () => listAcademicCalendars(page, 20) });
  const { data: yearsData } = useQuery({ queryKey: ['academic-years', 1, 100], queryFn: () => listAcademicYears(1, 100) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      academicYearId: row.academicYearId?._id || row.academicYearId || '',
      title: row.title,
      eventType: row.eventType,
      startDate: row.startDate?.substring(0, 10) || '',
      endDate: row.endDate?.substring(0, 10) || '',
      description: row.description || '',
      isHoliday: row.isHoliday || false,
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createAcademicCalendar, onSuccess: () => { qc.invalidateQueries({ queryKey: ['academic-calendar'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateAcademicCalendar(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['academic-calendar'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteAcademicCalendar, onSuccess: () => qc.invalidateQueries({ queryKey: ['academic-calendar'] }) });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: form });
    else createMut.mutate(form);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium text-navy">{r.title}</span> },
    { key: 'eventType', label: 'Type', render: (r: any) => <Badge variant={EVENT_COLOR[r.eventType]}>{r.eventType}</Badge> },
    { key: 'startDate', label: 'Start', render: (r: any) => new Date(r.startDate).toLocaleDateString() },
    { key: 'endDate', label: 'End', render: (r: any) => new Date(r.endDate).toLocaleDateString() },
    { key: 'isHoliday', label: 'Holiday', render: (r: any) => r.isHoliday ? <Badge variant="success">Yes</Badge> : '—' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Academic Calendar</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Event</button>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView} />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Calendar Event')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className={lbl}>Academic Year *</label>
                <select required value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))} className={inp}>
                  <option value="">Select...</option>
                  {yearsData?.items?.map((y: any) => <option key={y._id} value={y._id}>{y.label}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className={lbl}>Title *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Event Type *</label>
                <select required value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))} className={inp}>
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex items-end pb-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isHoliday} onChange={e => setForm(f => ({ ...f, isHoliday: e.target.checked }))} /> Is Holiday</label></div>
              <div><label className={lbl}>Start Date *</label><input required type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>End Date *</label><input required type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} rows={2} /></div>
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
