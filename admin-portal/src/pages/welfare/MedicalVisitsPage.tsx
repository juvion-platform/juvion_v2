import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listMedicalVisits, createMedicalVisit, updateMedicalVisit, deleteMedicalVisit } from '../../services/welfare';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { personId: '', visitDate: '', complaint: '', diagnosis: '', prescription: '', referredTo: '', attendedBy: '', followUpDate: '' };

export default function MedicalVisitsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['medical-visits', page, limit, search], queryFn: () => listMedicalVisits(page, limit, search) });
  const { data: personsData } = useQuery({ queryKey: ['persons', 'all'], queryFn: () => listPersons(1, 200) });
  const persons = personsData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      personId: row.personId?._id || row.personId || '',
      visitDate: row.visitDate ? row.visitDate.slice(0, 10) : '',
      complaint: row.complaint || '',
      diagnosis: row.diagnosis || '',
      prescription: row.prescription || '',
      referredTo: row.referredTo || '',
      attendedBy: row.attendedBy || '',
      followUpDate: row.followUpDate ? row.followUpDate.slice(0, 10) : '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createMedicalVisit, onSuccess: () => { qc.invalidateQueries({ queryKey: ['medical-visits'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateMedicalVisit(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['medical-visits'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteMedicalVisit, onSuccess: () => { qc.invalidateQueries({ queryKey: ['medical-visits'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.visitDate) delete payload.visitDate;
    if (!payload.diagnosis) delete payload.diagnosis;
    if (!payload.prescription) delete payload.prescription;
    if (!payload.referredTo) delete payload.referredTo;
    if (!payload.followUpDate) delete payload.followUpDate;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'personId', label: 'Person', render: (r: any) => <span className="font-medium text-navy">{r.personId?.name || '\u2014'}</span> },
    { key: 'visitDate', label: 'Date', render: (r: any) => r.visitDate ? new Date(r.visitDate).toLocaleDateString() : '\u2014' },
    { key: 'complaint', label: 'Complaint' },
    { key: 'diagnosis', label: 'Diagnosis', render: (r: any) => r.diagnosis || '\u2014' },
    { key: 'attendedBy', label: 'Attended By' },
    { key: 'followUpDate', label: 'Follow-up', render: (r: any) => r.followUpDate ? new Date(r.followUpDate).toLocaleDateString() : '\u2014' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this visit?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Medical Visits</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search medical visits…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Visit
        </button>
      </div>
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Medical Visit')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Person * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.personId} onChange={e => setForm(f => ({ ...f, personId: e.target.value }))} className={inp}>
                  <option value="">Select person...</option>
                  {persons.map((p: any) => <option key={p._id} value={p._id}>{p.name || p._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Visit Date</label><input type="date" value={form.visitDate} onChange={e => setForm(f => ({ ...f, visitDate: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Complaint *</label><input required value={form.complaint} onChange={e => setForm(f => ({ ...f, complaint: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Diagnosis</label><input value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Prescription</label><input value={form.prescription} onChange={e => setForm(f => ({ ...f, prescription: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Referred To</label><input value={form.referredTo} onChange={e => setForm(f => ({ ...f, referredTo: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Attended By *</label><input required value={form.attendedBy} onChange={e => setForm(f => ({ ...f, attendedBy: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Follow-up Date</label><input type="date" value={form.followUpDate} onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))} className={inp} /></div>
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
