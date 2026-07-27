import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSkillCertifications, createSkillCertification, updateSkillCertification, deleteSkillCertification } from '../../services/student-dev';
import { listStudents } from '../../services/people';
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

const emptyForm = { studentId: '', certificationName: '', provider: '', completedDate: '', certificateUrl: '', credentialId: '', validUntil: '' };

export default function SkillCertificationsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      studentId: row.studentId?._id || row.studentId || '',
      certificationName: row.certificationName || '',
      provider: row.provider || '',
      completedDate: row.completedDate ? row.completedDate.slice(0, 10) : '',
      certificateUrl: row.certificateUrl || '',
      credentialId: row.credentialId || '',
      validUntil: row.validUntil ? row.validUntil.slice(0, 10) : '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const { data, isLoading } = useQuery({ queryKey: ['sd-skill-certifications', page, limit, search], queryFn: () => listSkillCertifications(page, limit, undefined, search) });
  const { data: students } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });

  const createMut = useMutation({ mutationFn: createSkillCertification, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-skill-certifications'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateSkillCertification(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-skill-certifications'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteSkillCertification, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-skill-certifications'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.certificateUrl) delete payload.certificateUrl;
    if (!payload.credentialId) delete payload.credentialId;
    if (!payload.validUntil) delete payload.validUntil;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const columns = [
    { key: 'certificationName', label: 'Certification', render: (r: any) => <span className="font-medium text-navy">{r.certificationName}</span> },
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014' },
    { key: 'provider', label: 'Provider', render: (r: any) => r.provider },
    { key: 'completedDate', label: 'Completed', render: (r: any) => fmtDate(r.completedDate) },
    { key: 'credentialId', label: 'Credential ID', render: (r: any) => r.credentialId || '\u2014' },
    { key: 'validUntil', label: 'Valid Until', render: (r: any) => fmtDate(r.validUntil) },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this certification?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Skill Certifications</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search skill certifications…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Certification
        </button>
      </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView} />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Certification')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Student * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student</option>
                  {(students?.items || []).map((s: any) => (
                    <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Certification Name *</label><input required value={form.certificationName} onChange={e => setForm(f => ({ ...f, certificationName: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Provider *</label><input required value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Completed Date *</label><input required type="date" value={form.completedDate} onChange={e => setForm(f => ({ ...f, completedDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Certificate URL</label><input value={form.certificateUrl} onChange={e => setForm(f => ({ ...f, certificateUrl: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Credential ID</label><input value={form.credentialId} onChange={e => setForm(f => ({ ...f, credentialId: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Valid Until</label><input type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} className={inp} /></div>
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
                {saving ? 'Saving\u2026' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
