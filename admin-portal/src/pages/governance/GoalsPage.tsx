import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listGoals, createGoal, updateGoal, deleteGoal } from '../../services/governance';
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

const CATEGORIES = ['academic_excellence', 'research', 'infrastructure', 'placement', 'accreditation', 'outreach', 'revenue'] as const;
const STATUSES = ['active', 'achieved', 'on_track', 'at_risk', 'missed'] as const;
const STATUS_COLOR: Record<string, string> = { active: 'info', achieved: 'success', on_track: 'success', at_risk: 'warning', missed: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { title: '', description: '', category: 'academic_excellence', targetDate: '', ownerId: '', status: 'active', kpis: '' };

function kpisToText(kpis: any[]): string {
  if (!kpis || !kpis.length) return '';
  return kpis.map(k => `${k.metric}|${k.target}|${k.current ?? 0}`).join('\n');
}

function textToKpis(text: string): any[] {
  if (!text.trim()) return [];
  return text.split('\n').filter(Boolean).map(line => {
    const [metric, target, current] = line.split('|');
    return { metric: metric?.trim() || '', target: Number(target) || 0, current: Number(current) || 0 };
  });
}

export default function GoalsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['gov-goals', page, limit, search], queryFn: () => listGoals(page, limit, undefined, undefined, search) });
  const { data: persons } = useQuery({ queryKey: ['persons', 'all'], queryFn: () => listPersons(1, 200) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      title: row.title || '',
      description: row.description || '',
      category: row.category || 'academic_excellence',
      targetDate: row.targetDate ? row.targetDate.slice(0, 10) : '',
      ownerId: row.ownerId?._id || row.ownerId || '',
      status: row.status || 'active',
      kpis: kpisToText(row.kpis),
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createGoal, onSuccess: () => { qc.invalidateQueries({ queryKey: ['gov-goals'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateGoal(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['gov-goals'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteGoal, onSuccess: () => { qc.invalidateQueries({ queryKey: ['gov-goals'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, kpis: textToKpis(form.kpis) };
    if (!payload.description) delete payload.description;
    if (!payload.ownerId) delete payload.ownerId;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const kpiProgress = (kpis: any[]) => {
    if (!kpis?.length) return '\u2014';
    return kpis.map(k => `${k.metric}: ${k.current ?? 0}/${k.target}`).join(', ');
  };

  const columns = [
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium text-navy">{r.title}</span> },
    { key: 'category', label: 'Category', render: (r: any) => <Badge variant="info">{r.category}</Badge> },
    { key: 'targetDate', label: 'Target', render: (r: any) => fmtDate(r.targetDate) },
    { key: 'kpis', label: 'KPIs', render: (r: any) => <span className="text-xs truncate max-w-[200px] block">{kpiProgress(r.kpis)}</span> },
    { key: 'ownerId', label: 'Owner', render: (r: any) => r.ownerId?.name || '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={(STATUS_COLOR[r.status] || 'default') as any}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this goal?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Strategic Goals</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search strategic goals…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Goal
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Goal')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Title *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Category *</label>
                <select required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className={lbl}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} rows={2} /></div>
              <div><label className={lbl}>Target Date *</label><input required type="date" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} className={inp} /></div>
              <div>
                <label className={lbl}>Owner {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.ownerId} onChange={e => setForm(f => ({ ...f, ownerId: e.target.value }))} className={inp}>
                  <option value="">Select person</option>
                  {(persons?.items || []).map((p: any) => (
                    <option key={p._id} value={p._id}>{p.name || p._id}</option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={lbl}>KPIs (metric|target|current, one per line)</label>
                <textarea value={form.kpis} onChange={e => setForm(f => ({ ...f, kpis: e.target.value }))} className={inp} rows={3} placeholder="e.g. Pass Rate|90|75" />
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
