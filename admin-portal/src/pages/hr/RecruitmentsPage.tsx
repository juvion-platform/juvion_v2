import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listRecruitments, createRecruitment, updateRecruitment, deleteRecruitment } from '../../services/hr';
import { listDepartments } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUSES = ['open', 'closed', 'on_hold', 'filled'] as const;
const STATUS_COLOR: Record<string, string> = { open: 'success', closed: 'default', on_hold: 'warning', filled: 'info' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function RecruitmentsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ position: '', departmentId: '', vacancies: '', qualifications: '', experience: '', salary: '', lastDate: '', status: 'open' });

  const { data, isLoading } = useQuery({ queryKey: ['recruitments', page], queryFn: () => listRecruitments(page, 20) });
  const { data: departments } = useQuery({ queryKey: ['departments', 'all'], queryFn: () => listDepartments(1, 100) });

  const createMut = useMutation({ mutationFn: createRecruitment, onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruitments'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateRecruitment(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruitments'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteRecruitment, onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruitments'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ position: '', departmentId: '', vacancies: '', qualifications: '', experience: '', salary: '', lastDate: '', status: 'open' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      position: row.position || '',
      departmentId: row.departmentId?._id || row.departmentId || '',
      vacancies: String(row.vacancies || ''),
      qualifications: row.qualifications || '',
      experience: row.experience || '',
      salary: row.salary || '',
      lastDate: row.lastDate ? row.lastDate.slice(0, 10) : '',
      status: row.status || 'open',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, vacancies: Number(form.vacancies) };
    if (!payload.experience) delete payload.experience;
    if (!payload.salary) delete payload.salary;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'position', label: 'Position', render: (r: any) => <span className="font-medium text-navy">{r.position}</span> },
    { key: 'departmentId', label: 'Department', render: (r: any) => r.departmentId?.name || '—' },
    { key: 'vacancies', label: 'Vacancies', render: (r: any) => r.vacancies },
    { key: 'lastDate', label: 'Last Date', render: (r: any) => r.lastDate ? new Date(r.lastDate).toLocaleDateString() : '-' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this recruitment?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Recruitments</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Recruitment
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Recruitment' : 'New Recruitment'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Position *</label><input required value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className={inp} /></div>
            <div>
              <label className={lbl}>Department * <Link to="/academics/departments" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} className={inp}>
                <option value="">Select department</option>
                {(departments?.items || []).map((d: any) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div><label className={lbl}>Vacancies *</label><input required type="number" min={1} value={form.vacancies} onChange={e => setForm(f => ({ ...f, vacancies: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Qualifications *</label><input required value={form.qualifications} onChange={e => setForm(f => ({ ...f, qualifications: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Experience</label><input value={form.experience} onChange={e => setForm(f => ({ ...f, experience: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Salary</label><input value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Last Date *</label><input required type="date" value={form.lastDate} onChange={e => setForm(f => ({ ...f, lastDate: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
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
