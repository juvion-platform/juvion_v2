import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAlumniProfiles, createAlumniProfile, updateAlumniProfile, deleteAlumniProfile } from '../../services/placement';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useHighlightRow } from '../../hooks/useHighlightRow';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { personId: '', graduationYear: '', currentCompany: '', currentDesignation: '', location: '', linkedinUrl: '', willingToMentor: false };

export default function AlumniProfilesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['alumni-profiles', page], queryFn: () => listAlumniProfiles(page, 20) });
  const { data: persons } = useQuery({ queryKey: ['persons-all'], queryFn: () => listPersons(1, 200) });

  // Consume ?highlight=<personId> from global-people-search.
  const { highlightAttrs } = useHighlightRow({ ready: !isLoading && Boolean(data) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      personId: row.personId?._id || row.personId || '',
      graduationYear: String(row.graduationYear || ''),
      currentCompany: row.currentCompany || '',
      currentDesignation: row.currentDesignation || '',
      location: row.location || '',
      linkedinUrl: row.linkedinUrl || '',
      willingToMentor: row.willingToMentor ?? false,
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createAlumniProfile, onSuccess: () => { qc.invalidateQueries({ queryKey: ['alumni-profiles'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateAlumniProfile(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['alumni-profiles'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteAlumniProfile, onSuccess: () => { qc.invalidateQueries({ queryKey: ['alumni-profiles'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, graduationYear: Number(form.graduationYear) };
    if (!payload.currentCompany) delete payload.currentCompany;
    if (!payload.currentDesignation) delete payload.currentDesignation;
    if (!payload.location) delete payload.location;
    if (!payload.linkedinUrl) delete payload.linkedinUrl;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'personId', label: 'Person', render: (r: any) => <span className="font-medium text-navy">{r.personId?.name || '--'}</span> },
    { key: 'graduationYear', label: 'Grad Year' },
    { key: 'currentCompany', label: 'Company', render: (r: any) => r.currentCompany || '--' },
    { key: 'currentDesignation', label: 'Designation', render: (r: any) => r.currentDesignation || '--' },
    { key: 'location', label: 'Location', render: (r: any) => r.location || '--' },
    { key: 'willingToMentor', label: 'Mentor', render: (r: any) => <Badge variant={r.willingToMentor ? 'success' : 'default'}>{r.willingToMentor ? 'Yes' : 'No'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this profile?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Alumni Profiles</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Profile</button>
      </div>
      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
        rowProps={(r: any) => highlightAttrs(
          typeof r.personId === 'string' ? r.personId : r.personId?._id,
        )}
      />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Alumni Profile')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Person * {!vem.isView && <Link to="/people/persons" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.personId} onChange={e => setForm(f => ({ ...f, personId: e.target.value }))} className={inp}>
                  <option value="">Select person</option>
                  {(persons?.items || []).map((p: any) => <option key={p._id} value={p._id}>{p.name || p._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Graduation Year *</label><input required type="number" min={1900} value={form.graduationYear} onChange={e => setForm(f => ({ ...f, graduationYear: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Current Company</label><input value={form.currentCompany} onChange={e => setForm(f => ({ ...f, currentCompany: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Current Designation</label><input value={form.currentDesignation} onChange={e => setForm(f => ({ ...f, currentDesignation: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Location</label><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>LinkedIn URL</label><input value={form.linkedinUrl} onChange={e => setForm(f => ({ ...f, linkedinUrl: e.target.value }))} className={inp} /></div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="alumniMentor" checked={form.willingToMentor} onChange={e => setForm(f => ({ ...f, willingToMentor: e.target.checked }))} className="rounded" />
                <label htmlFor="alumniMentor" className="text-sm text-gray-700">Willing to Mentor</label>
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
