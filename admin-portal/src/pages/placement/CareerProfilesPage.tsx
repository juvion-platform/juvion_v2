import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCareerProfiles, createCareerProfile, updateCareerProfile, deleteCareerProfile, listPlacementSeasons } from '../../services/placement';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUSES = ['draft', 'incomplete', 'complete', 'validated'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function CareerProfilesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ studentId: '', placementSeasonId: '', status: 'draft', cgpa: '', activeBacklogs: '0', programme: '', branch: '', targetRoles: '', preferredLocations: '', expectedCtcLpa: '', willingToRelocate: false });

  const { data, isLoading } = useQuery({ queryKey: ['career-profiles', page], queryFn: () => listCareerProfiles(page, 20) });
  const { data: students } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 200) });
  const { data: seasons } = useQuery({ queryKey: ['placement-seasons-all'], queryFn: () => listPlacementSeasons(1, 100) });

  const createMut = useMutation({ mutationFn: createCareerProfile, onSuccess: () => { qc.invalidateQueries({ queryKey: ['career-profiles'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateCareerProfile(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['career-profiles'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteCareerProfile, onSuccess: () => { qc.invalidateQueries({ queryKey: ['career-profiles'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ studentId: '', placementSeasonId: '', status: 'draft', cgpa: '', activeBacklogs: '0', programme: '', branch: '', targetRoles: '', preferredLocations: '', expectedCtcLpa: '', willingToRelocate: false });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      studentId: row.studentId?._id || row.studentId || '',
      placementSeasonId: row.placementSeasonId?._id || row.placementSeasonId || '',
      status: row.status || 'draft',
      cgpa: row.academicSummary?.cgpa != null ? String(row.academicSummary.cgpa) : '',
      activeBacklogs: row.academicSummary?.activeBacklogs != null ? String(row.academicSummary.activeBacklogs) : '0',
      programme: row.academicSummary?.programme || '',
      branch: row.academicSummary?.branch || '',
      targetRoles: row.careerPreferences?.targetRoles?.join(', ') || '',
      preferredLocations: row.careerPreferences?.preferredLocations?.join(', ') || '',
      expectedCtcLpa: row.careerPreferences?.expectedCtcLpa != null ? String(row.careerPreferences.expectedCtcLpa) : '',
      willingToRelocate: row.careerPreferences?.willingToRelocate || false,
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      studentId: form.studentId,
      placementSeasonId: form.placementSeasonId,
      status: form.status,
      academicSummary: {
        cgpa: form.cgpa ? Number(form.cgpa) : undefined,
        activeBacklogs: Number(form.activeBacklogs),
        programme: form.programme || undefined,
        branch: form.branch || undefined,
      },
      careerPreferences: {
        targetRoles: form.targetRoles ? form.targetRoles.split(',').map(s => s.trim()).filter(Boolean) : [],
        preferredLocations: form.preferredLocations ? form.preferredLocations.split(',').map(s => s.trim()).filter(Boolean) : [],
        expectedCtcLpa: form.expectedCtcLpa ? Number(form.expectedCtcLpa) : undefined,
        willingToRelocate: form.willingToRelocate,
      },
    };
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const statusVariant: Record<string, string> = { draft: 'default', incomplete: 'warning', complete: 'success', validated: 'info' };

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.firstName ? `${r.studentId.firstName} ${r.studentId.lastName || ''}` : '--'}</span> },
    { key: 'careerObjective', label: 'Target Roles', render: (r: any) => r.careerPreferences?.targetRoles?.join(', ') || '--' },
    { key: 'preferredLocations', label: 'Preferred Locations', render: (r: any) => r.careerPreferences?.preferredLocations?.join(', ') || '--' },
    { key: 'expectedCtcLpa', label: 'Expected CTC', render: (r: any) => r.careerPreferences?.expectedCtcLpa ? `${r.careerPreferences.expectedCtcLpa} LPA` : '--' },
    { key: 'profileCompletenessScore', label: 'Completeness', render: (r: any) => `${r.profileCompletenessScore || 0}%` },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={statusVariant[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this career profile?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Career Profiles</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Career Profile</button>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Career Profile' : 'New Career Profile'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Student *</label>
              <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                <option value="">Select student</option>
                {(students?.items || []).map((s: any) => <option key={s._id} value={s._id}>{s.firstName} {s.lastName || ''} ({s.rollNumber || s.registrationNumber || ''})</option>)}
              </select>
            </div>
            <div><label className={lbl}>Season * <Link to="/placement/seasons" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.placementSeasonId} onChange={e => setForm(f => ({ ...f, placementSeasonId: e.target.value }))} className={inp}>
                <option value="">Select season</option>
                {(seasons?.items || []).map((s: any) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={lbl}>CGPA</label><input type="number" step="0.01" min={0} max={10} value={form.cgpa} onChange={e => setForm(f => ({ ...f, cgpa: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Active Backlogs</label><input type="number" min={0} value={form.activeBacklogs} onChange={e => setForm(f => ({ ...f, activeBacklogs: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Programme</label><input value={form.programme} onChange={e => setForm(f => ({ ...f, programme: e.target.value }))} className={inp} placeholder="e.g. B.Tech" /></div>
            <div><label className={lbl}>Branch</label><input value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} className={inp} placeholder="e.g. CSE" /></div>
            <div><label className={lbl}>Expected CTC (LPA)</label><input type="number" step="0.1" min={0} value={form.expectedCtcLpa} onChange={e => setForm(f => ({ ...f, expectedCtcLpa: e.target.value }))} className={inp} /></div>
            <div className="col-span-2"><label className={lbl}>Target Roles (comma-separated)</label><input value={form.targetRoles} onChange={e => setForm(f => ({ ...f, targetRoles: e.target.value }))} className={inp} placeholder="e.g. Software Engineer, Data Analyst" /></div>
            <div className="col-span-2"><label className={lbl}>Preferred Locations (comma-separated)</label><input value={form.preferredLocations} onChange={e => setForm(f => ({ ...f, preferredLocations: e.target.value }))} className={inp} placeholder="e.g. Hyderabad, Bangalore" /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="relocate" checked={form.willingToRelocate} onChange={e => setForm(f => ({ ...f, willingToRelocate: e.target.checked }))} className="rounded border-gray-300" />
              <label htmlFor="relocate" className="text-sm text-gray-700">Willing to Relocate</label>
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
