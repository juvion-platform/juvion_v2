import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSportsTeams, createSportsTeam, updateSportsTeam, deleteSportsTeam } from '../../services/student-dev';
import { listStudents, listPersons } from '../../services/people';
import { listAcademicYears } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const CATEGORIES = ['men', 'women', 'mixed'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { sport: '', category: 'men', coachId: '', captain: '', academicYearId: '' };

export default function SportsTeamsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      sport: row.sport || '',
      category: row.category || 'men',
      coachId: row.coachId?._id || row.coachId || '',
      captain: row.captain?._id || row.captain || '',
      academicYearId: row.academicYearId?._id || row.academicYearId || '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const { data, isLoading } = useQuery({ queryKey: ['sd-sports-teams', page], queryFn: () => listSportsTeams(page, 20) });
  const { data: persons } = useQuery({ queryKey: ['persons', 'all'], queryFn: () => listPersons(1, 200) });
  const { data: students } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });
  const { data: academicYears } = useQuery({ queryKey: ['academic-years', 'all'], queryFn: () => listAcademicYears(1, 100) });

  const createMut = useMutation({ mutationFn: createSportsTeam, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-sports-teams'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateSportsTeam(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-sports-teams'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteSportsTeam, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-sports-teams'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.coachId) delete payload.coachId;
    if (!payload.captain) delete payload.captain;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'sport', label: 'Sport', render: (r: any) => <span className="font-medium text-navy">{r.sport}</span> },
    { key: 'category', label: 'Category', render: (r: any) => <Badge variant="info">{r.category}</Badge> },
    { key: 'coachId', label: 'Coach', render: (r: any) => r.coachId?.name || '\u2014' },
    { key: 'captain', label: 'Captain', render: (r: any) => r.captain?.personId?.name || r.captain?.rollNumber || '\u2014' },
    { key: 'academicYearId', label: 'Academic Year', render: (r: any) => r.academicYearId?.label || r.academicYearId?.code || '\u2014' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this team?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Sports Teams</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Team
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Sports Team')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Sport *</label><input required value={form.sport} onChange={e => setForm(f => ({ ...f, sport: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Category *</label>
                <select required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Coach {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.coachId} onChange={e => setForm(f => ({ ...f, coachId: e.target.value }))} className={inp}>
                  <option value="">Select person</option>
                  {(persons?.items || []).map((p: any) => (
                    <option key={p._id} value={p._id}>{p.name || p._id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Captain {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.captain} onChange={e => setForm(f => ({ ...f, captain: e.target.value }))} className={inp}>
                  <option value="">Select student</option>
                  {(students?.items || []).map((s: any) => (
                    <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Academic Year * {!vem.isView && <Link to="/academics" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))} className={inp}>
                  <option value="">Select academic year</option>
                  {(academicYears?.items || []).map((ay: any) => (
                    <option key={ay._id} value={ay._id}>{ay.label || ay.code}</option>
                  ))}
                </select>
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
                {saving ? 'Saving\u2026' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
