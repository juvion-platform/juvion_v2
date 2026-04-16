import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSkillRecords, createSkillRecord, updateSkillRecord, deleteSkillRecord } from '../../services/placement';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const CATEGORIES = ['aptitude', 'technical', 'soft_skills', 'domain'] as const;
const SOURCES = ['assessment', 'training_assessment', 'self_reported', 'certification', 'mock_interview'] as const;
const VERIFICATION_STATUSES = ['unverified', 'verified', 'rejected'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function SkillRecordsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ studentId: '', skillName: '', category: 'technical', source: 'assessment', score: '', percentile: '', vendor: '', assessedAt: '', verificationStatus: 'unverified' });

  const { data, isLoading } = useQuery({ queryKey: ['skill-records', page], queryFn: () => listSkillRecords(page, 20) });
  const { data: students } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 200) });

  const createMut = useMutation({ mutationFn: createSkillRecord, onSuccess: () => { qc.invalidateQueries({ queryKey: ['skill-records'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateSkillRecord(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['skill-records'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteSkillRecord, onSuccess: () => { qc.invalidateQueries({ queryKey: ['skill-records'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ studentId: '', skillName: '', category: 'technical', source: 'assessment', score: '', percentile: '', vendor: '', assessedAt: '', verificationStatus: 'unverified' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      studentId: row.studentId?._id || row.studentId || '',
      skillName: row.skillName || '',
      category: row.category || 'technical',
      source: row.source || 'assessment',
      score: row.score != null ? String(row.score) : '',
      percentile: row.percentile != null ? String(row.percentile) : '',
      vendor: row.vendor || '',
      assessedAt: row.assessedAt ? row.assessedAt.slice(0, 10) : '',
      verificationStatus: row.verificationStatus || 'unverified',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      studentId: form.studentId,
      skillName: form.skillName,
      category: form.category,
      source: form.source,
      verificationStatus: form.verificationStatus,
    };
    if (form.score) payload.score = Number(form.score);
    if (form.percentile) payload.percentile = Number(form.percentile);
    if (form.vendor) payload.vendor = form.vendor;
    if (form.assessedAt) payload.assessedAt = form.assessedAt;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const categoryVariant: Record<string, string> = { aptitude: 'info', technical: 'success', soft_skills: 'warning', domain: 'default' };
  const verificationVariant: Record<string, string> = { unverified: 'default', verified: 'success', rejected: 'danger' };

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.firstName ? `${r.studentId.firstName} ${r.studentId.lastName || ''}` : '--'}</span> },
    { key: 'skillName', label: 'Skill', render: (r: any) => r.skillName || '--' },
    { key: 'category', label: 'Category', render: (r: any) => <Badge variant={categoryVariant[r.category] || 'default'}>{r.category?.replace(/_/g, ' ')}</Badge> },
    { key: 'source', label: 'Source', render: (r: any) => r.source?.replace(/_/g, ' ') || '--' },
    { key: 'score', label: 'Score', render: (r: any) => r.score != null ? r.score : '--' },
    { key: 'verificationStatus', label: 'Verification', render: (r: any) => <Badge variant={verificationVariant[r.verificationStatus] || 'default'}>{r.verificationStatus}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this skill record?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Skill Records</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Skill Record</button>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Skill Record' : 'New Skill Record'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Student *</label>
              <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                <option value="">Select student</option>
                {(students?.items || []).map((s: any) => <option key={s._id} value={s._id}>{s.firstName} {s.lastName || ''} ({s.rollNumber || s.registrationNumber || ''})</option>)}
              </select>
            </div>
            <div><label className={lbl}>Skill Name *</label><input required value={form.skillName} onChange={e => setForm(f => ({ ...f, skillName: e.target.value }))} className={inp} placeholder="e.g. Java, Communication" /></div>
            <div><label className={lbl}>Category *</label>
              <select required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Source *</label>
              <select required value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className={inp}>
                {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Score</label><input type="number" min={0} value={form.score} onChange={e => setForm(f => ({ ...f, score: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Percentile</label><input type="number" min={0} max={100} step="0.01" value={form.percentile} onChange={e => setForm(f => ({ ...f, percentile: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Vendor</label><input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} className={inp} placeholder="e.g. AMCAT, CoCubes" /></div>
            <div><label className={lbl}>Assessed At</label><input type="date" value={form.assessedAt} onChange={e => setForm(f => ({ ...f, assessedAt: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Verification Status</label>
              <select value={form.verificationStatus} onChange={e => setForm(f => ({ ...f, verificationStatus: e.target.value }))} className={inp}>
                {VERIFICATION_STATUSES.map(v => <option key={v} value={v}>{v}</option>)}
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
