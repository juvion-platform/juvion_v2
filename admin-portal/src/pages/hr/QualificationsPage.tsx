import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listQualifications, createQualification, updateQualification, deleteQualification } from '../../services/hr';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function QualificationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ personId: '', degree: '', specialization: '', university: '', yearOfPassing: '', percentage: '', cgpa: '', isHighest: false });

  const { data, isLoading } = useQuery({ queryKey: ['qualifications', page], queryFn: () => listQualifications(page, 20) });

  const createMut = useMutation({ mutationFn: createQualification, onSuccess: () => { qc.invalidateQueries({ queryKey: ['qualifications'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateQualification(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['qualifications'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteQualification, onSuccess: () => { qc.invalidateQueries({ queryKey: ['qualifications'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ personId: '', degree: '', specialization: '', university: '', yearOfPassing: '', percentage: '', cgpa: '', isHighest: false });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      personId: row.personId?._id || row.personId || '',
      degree: row.degree || '',
      specialization: row.specialization || '',
      university: row.university || '',
      yearOfPassing: String(row.yearOfPassing ?? ''),
      percentage: String(row.percentage ?? ''),
      cgpa: String(row.cgpa ?? ''),
      isHighest: row.isHighest ?? false,
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, yearOfPassing: Number(form.yearOfPassing), isHighest: form.isHighest };
    if (!payload.specialization) delete payload.specialization;
    if (form.percentage) payload.percentage = Number(form.percentage); else delete payload.percentage;
    if (form.cgpa) payload.cgpa = Number(form.cgpa); else delete payload.cgpa;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'personId', label: 'Person', render: (r: any) => <span className="font-medium text-navy">{r.personId?.name || '—'}</span> },
    { key: 'degree', label: 'Degree' },
    { key: 'university', label: 'University' },
    { key: 'yearOfPassing', label: 'Year' },
    { key: 'isHighest', label: 'Highest', render: (r: any) => r.isHighest ? <Badge variant="success">Highest</Badge> : <Badge variant="default">No</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this qualification?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Qualifications</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Qualification
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Qualification' : 'New Qualification'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Person ID *</label><input required value={form.personId} onChange={e => setForm(f => ({ ...f, personId: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Degree *</label><input required value={form.degree} onChange={e => setForm(f => ({ ...f, degree: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Specialization</label><input value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>University *</label><input required value={form.university} onChange={e => setForm(f => ({ ...f, university: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Year of Passing *</label><input required type="number" value={form.yearOfPassing} onChange={e => setForm(f => ({ ...f, yearOfPassing: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Percentage</label><input type="number" step="0.01" value={form.percentage} onChange={e => setForm(f => ({ ...f, percentage: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>CGPA</label><input type="number" step="0.01" value={form.cgpa} onChange={e => setForm(f => ({ ...f, cgpa: e.target.value }))} className={inp} /></div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="isHighest" checked={form.isHighest} onChange={e => setForm(f => ({ ...f, isHighest: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <label htmlFor="isHighest" className="text-sm font-medium text-gray-700">Highest Qualification</label>
            </div>
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
