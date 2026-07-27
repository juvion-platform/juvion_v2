import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listConstructionProjects, createConstructionProject, updateConstructionProject, deleteConstructionProject } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = { name:'', description:'', contractorName:'', estimatedCost:'', actualCost:'', startDate:'', expectedCompletion:'', actualCompletion:'', status:'planned' };

export default function ConstructionProjectsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['construction-projects', page, limit, search], queryFn: () => listConstructionProjects(page, limit, search) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({ name: row.name||'', description: row.description||'', contractorName: row.contractorName||'', estimatedCost: String(row.estimatedCost??''), actualCost: String(row.actualCost??''), startDate: row.startDate?.slice(0,10)||'', expectedCompletion: row.expectedCompletion?.slice(0,10)||'', actualCompletion: row.actualCompletion?.slice(0,10)||'', status: row.status||'planned' }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createConstructionProject, onSuccess: () => { qc.invalidateQueries({ queryKey: ['construction-projects'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateConstructionProject(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['construction-projects'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteConstructionProject, onSuccess: () => qc.invalidateQueries({ queryKey: ['construction-projects'] }) });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.estimatedCost) payload.estimatedCost = Number(form.estimatedCost);
    if(form.actualCost) payload.actualCost = Number(form.actualCost);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'contractorName', label: 'Contractor', render: (r: any) => r.contractorName||'\u2014' },
    { key: 'estimatedCost', label: 'Est. Cost', render: (r: any) => r.estimatedCost?`\u20B9${r.estimatedCost.toLocaleString()}`:'\u2014' },
    { key: 'startDate', label: 'Start', render: (r: any) => r.startDate?.slice(0,10)||'\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status==='completed'?'success':r.status==='in_progress'?'info':r.status==='cancelled'?'danger':'warning'}>{r.status?.replace(/_/g,' ')}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();vem.openForEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();void confirmAction({ title: 'Delete?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } })}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Construction Projects</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search construction projects…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No construction projects match “${search}”.` : 'No construction projects yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Construction Project')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e=>setForm(fm=>({...fm,name:e.target.value}))} className={inp}/></div>
              <div className="col-span-2"><label className={lbl}>Description</label><textarea value={form.description} onChange={e=>setForm(fm=>({...fm,description:e.target.value}))} className={inp} rows={3}/></div>
              <div><label className={lbl}>Contractor</label><input value={form.contractorName} onChange={e=>setForm(fm=>({...fm,contractorName:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Estimated Cost</label><input type="number" min={0} value={form.estimatedCost} onChange={e=>setForm(fm=>({...fm,estimatedCost:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Actual Cost</label><input type="number" min={0} value={form.actualCost} onChange={e=>setForm(fm=>({...fm,actualCost:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Start Date</label><input type="date" value={form.startDate} onChange={e=>setForm(fm=>({...fm,startDate:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Expected Completion</label><input type="date" value={form.expectedCompletion} onChange={e=>setForm(fm=>({...fm,expectedCompletion:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Actual Completion</label><input type="date" value={form.actualCompletion} onChange={e=>setForm(fm=>({...fm,actualCompletion:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(fm=>({...fm,status:e.target.value}))} className={inp}><option value="">None</option><option value="planned">planned</option><option value="in_progress">in progress</option><option value="completed">completed</option><option value="on_hold">on hold</option><option value="cancelled">cancelled</option></select></div>
            </div>
          </fieldset>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={vem.close} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">{vem.isView ? 'Close' : 'Cancel'}</button>
            {vem.isView ? (
              <button type="button" onClick={vem.switchToEdit} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"><Pencil size={14} /> Edit</button>
            ) : (
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}</button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
