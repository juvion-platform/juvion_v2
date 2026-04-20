import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from '../../services/platform';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const CATEGORIES = ['general', 'academic', 'exam', 'placement', 'event', 'hostel', 'sports', 'other'] as const;
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
const AUDIENCES = ['all', 'students', 'faculty', 'staff', 'parents'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = { title: '', content: '', category: 'general', priority: 'normal', postedBy: '', targetAudience: 'all', attachmentUrl: '', isPinned: false, expiryDate: '' };

export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['announcements', page], queryFn: () => listAnnouncements(page, 20) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      title: row.title || '',
      content: row.content || '',
      category: row.category || 'general',
      priority: row.priority || 'normal',
      postedBy: row.postedBy?._id || row.postedBy || '',
      targetAudience: row.targetAudience || 'all',
      attachmentUrl: row.attachmentUrl || '',
      isPinned: row.isPinned || false,
      expiryDate: row.expiryDate ? row.expiryDate.slice(0, 10) : '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createAnnouncement, onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateAnnouncement(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteAnnouncement, onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.attachmentUrl) delete payload.attachmentUrl;
    if (!payload.expiryDate) delete payload.expiryDate;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const priorityBadge = (p: string) => {
    const map: Record<string, string> = { low: 'default', normal: 'info', high: 'warning', urgent: 'danger' };
    return <Badge variant={(map[p] || 'default') as any}>{p}</Badge>;
  };

  const columns = [
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium text-navy">{r.title}</span> },
    { key: 'category', label: 'Category', render: (r: any) => <Badge variant="info">{r.category}</Badge> },
    { key: 'priority', label: 'Priority', render: (r: any) => priorityBadge(r.priority) },
    { key: 'targetAudience', label: 'Audience', render: (r: any) => r.targetAudience },
    { key: 'isPinned', label: 'Pinned', render: (r: any) => r.isPinned ? 'Yes' : 'No' },
    { key: 'createdAt', label: 'Created', render: (r: any) => fmtDate(r.createdAt) },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this announcement?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Announcements</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Announcement
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Announcement')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className={lbl}>Title *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Content *</label><textarea required rows={3} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Category *</label>
                <select required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Priority</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={inp}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Posted By (Person ID) *</label><input required value={form.postedBy} onChange={e => setForm(f => ({ ...f, postedBy: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Target Audience *</label>
                <select required value={form.targetAudience} onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))} className={inp}>
                  {AUDIENCES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Attachment URL</label><input value={form.attachmentUrl} onChange={e => setForm(f => ({ ...f, attachmentUrl: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Expiry Date</label><input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} className={inp} /></div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="isPinned" checked={form.isPinned} onChange={e => setForm(f => ({ ...f, isPinned: e.target.checked }))} />
                <label htmlFor="isPinned" className="text-sm text-gray-700">Pin this announcement</label>
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
