import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPublications, createPublication, updatePublication, deletePublication } from '../../services/hr';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const TYPES = ['journal', 'conference', 'book', 'book_chapter', 'patent'] as const;
const INDEXINGS = ['scopus', 'sci', 'wos', 'ugc_care', 'other'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = {
  facultyId: '', title: '', type: 'journal' as string, journalName: '', conferenceName: '',
  publishedDate: '', doi: '', impactFactor: '', indexing: '',
};

export default function PublicationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['publications', page], queryFn: () => listPublications(page, 20) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      facultyId: row.facultyId?._id || row.facultyId || '',
      title: row.title || '',
      type: row.type || 'journal',
      journalName: row.journalName || '',
      conferenceName: row.conferenceName || '',
      publishedDate: row.publishedDate ? row.publishedDate.slice(0, 10) : '',
      doi: row.doi || '',
      impactFactor: row.impactFactor != null ? String(row.impactFactor) : '',
      indexing: row.indexing || '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createPublication, onSuccess: () => { qc.invalidateQueries({ queryKey: ['publications'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updatePublication(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['publications'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deletePublication, onSuccess: () => { qc.invalidateQueries({ queryKey: ['publications'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (form.impactFactor) payload.impactFactor = Number(form.impactFactor);
    else delete payload.impactFactor;
    if (!form.journalName) delete payload.journalName;
    if (!form.conferenceName) delete payload.conferenceName;
    if (!form.publishedDate) delete payload.publishedDate;
    if (!form.doi) delete payload.doi;
    if (!form.indexing) delete payload.indexing;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium text-navy">{r.title}</span> },
    { key: 'facultyId', label: 'Faculty', render: (r: any) => <span>{r.facultyId?.personId?.name || '\u2014'}</span> },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant="info">{r.type}</Badge> },
    { key: 'publishedDate', label: 'Published', render: (r: any) => r.publishedDate ? new Date(r.publishedDate).toLocaleDateString() : '\u2014' },
    { key: 'indexing', label: 'Indexing', render: (r: any) => r.indexing ? <Badge variant="default">{r.indexing}</Badge> : '\u2014' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this publication?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Publications</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Publication
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
      />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Publication')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Faculty ID *</label>
                <input required value={form.facultyId} onChange={e => setForm(f => ({ ...f, facultyId: e.target.value }))} className={inp} placeholder="Faculty ID" />
              </div>
              <div><label className={lbl}>Title *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Type *</label>
                <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Journal Name</label>
                <input value={form.journalName} onChange={e => setForm(f => ({ ...f, journalName: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Conference Name</label>
                <input value={form.conferenceName} onChange={e => setForm(f => ({ ...f, conferenceName: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Published Date</label>
                <input type="date" value={form.publishedDate} onChange={e => setForm(f => ({ ...f, publishedDate: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>DOI</label>
                <input value={form.doi} onChange={e => setForm(f => ({ ...f, doi: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Impact Factor</label>
                <input type="number" step="any" min={0} value={form.impactFactor} onChange={e => setForm(f => ({ ...f, impactFactor: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Indexing</label>
                <select value={form.indexing} onChange={e => setForm(f => ({ ...f, indexing: e.target.value }))} className={inp}>
                  <option value="">— None —</option>
                  {INDEXINGS.map(i => <option key={i} value={i}>{i}</option>)}
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
                {saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
