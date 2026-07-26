import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listHealthRecords, createHealthRecord, updateHealthRecord, deleteHealthRecord } from '../../services/welfare';
import { listPersons } from '../../services/people';
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

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { personId: '', bloodGroup: '', allergies: '', chronicConditions: '', emergencyContact: '', emergencyPhone: '', insuranceId: '' };

export default function HealthRecordsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['health-records', page, limit, search], queryFn: () => listHealthRecords(page, limit, search) });
  const { data: personsData } = useQuery({ queryKey: ['persons', 'all'], queryFn: () => listPersons(1, 200) });
  const persons = personsData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      personId: row.personId?._id || row.personId || '',
      bloodGroup: row.bloodGroup || '',
      allergies: (row.allergies || []).join(', '),
      chronicConditions: (row.chronicConditions || []).join(', '),
      emergencyContact: row.emergencyContact || '',
      emergencyPhone: row.emergencyPhone || '',
      insuranceId: row.insuranceId || '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createHealthRecord, onSuccess: () => { qc.invalidateQueries({ queryKey: ['health-records'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateHealthRecord(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['health-records'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteHealthRecord, onSuccess: () => { qc.invalidateQueries({ queryKey: ['health-records'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      ...form,
      allergies: form.allergies ? form.allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
      chronicConditions: form.chronicConditions ? form.chronicConditions.split(',').map(s => s.trim()).filter(Boolean) : [],
    };
    if (!payload.bloodGroup) delete payload.bloodGroup;
    if (!payload.insuranceId) delete payload.insuranceId;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'personId', label: 'Person', render: (r: any) => <span className="font-medium text-navy">{r.personId?.name || '\u2014'}</span> },
    { key: 'bloodGroup', label: 'Blood Group', render: (r: any) => r.bloodGroup ? <Badge variant="info">{r.bloodGroup}</Badge> : '\u2014' },
    { key: 'allergies', label: 'Allergies', render: (r: any) => (r.allergies || []).join(', ') || '\u2014' },
    { key: 'emergencyContact', label: 'Emergency Contact' },
    { key: 'emergencyPhone', label: 'Emergency Phone' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this record?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Health Records</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search health records…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Record
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Health Record')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Person * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.personId} onChange={e => setForm(f => ({ ...f, personId: e.target.value }))} className={inp}>
                  <option value="">Select person...</option>
                  {persons.map((p: any) => <option key={p._id} value={p._id}>{p.name || p._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Blood Group</label>
                <select value={form.bloodGroup} onChange={e => setForm(f => ({ ...f, bloodGroup: e.target.value }))} className={inp}>
                  <option value="">Select...</option>
                  {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Emergency Contact *</label><input required value={form.emergencyContact} onChange={e => setForm(f => ({ ...f, emergencyContact: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Emergency Phone *</label><input required value={form.emergencyPhone} onChange={e => setForm(f => ({ ...f, emergencyPhone: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Allergies (comma-separated)</label><input value={form.allergies} onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))} className={inp} placeholder="e.g. Peanuts, Penicillin" /></div>
              <div className="col-span-2"><label className={lbl}>Chronic Conditions (comma-separated)</label><input value={form.chronicConditions} onChange={e => setForm(f => ({ ...f, chronicConditions: e.target.value }))} className={inp} placeholder="e.g. Asthma, Diabetes" /></div>
              <div><label className={lbl}>Insurance ID</label><input value={form.insuranceId} onChange={e => setForm(f => ({ ...f, insuranceId: e.target.value }))} className={inp} /></div>
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
