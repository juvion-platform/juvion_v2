import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listConstructionProjects, createConstructionProject, updateConstructionProject, deleteConstructionProject } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const STATUS_OPTS = ['planned','in_progress','completed','on_hold','cancelled'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";


export default function ConstructionProjectsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name:'', description:'', contractorName:'', estimatedCost:'', actualCost:'', startDate:'', expectedCompletion:'', actualCompletion:'', status:'planned' });

  const { data, isLoading } = useQuery({ queryKey: ['construction-projects', page], queryFn: () => listConstructionProjects(page, 20) });

  const createMut = useMutation({ mutationFn: createConstructionProject, onSuccess: () => { qc.invalidateQueries({ queryKey: ['construction-projects'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateConstructionProject(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['construction-projects'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteConstructionProject, onSuccess: () => qc.invalidateQueries({ queryKey: ['construction-projects'] }) });

  function openCreate() { setEditing(null); setForm({ name:'', description:'', contractorName:'', estimatedCost:'', actualCost:'', startDate:'', expectedCompletion:'', actualCompletion:'', status:'planned' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ name: row.name||'', description: row.description||'', contractorName: row.contractorName||'', estimatedCost: String(row.estimatedCost??''), actualCost: String(row.actualCost??''), startDate: row.startDate?.slice(0,10)||'', expectedCompletion: row.expectedCompletion?.slice(0,10)||'', actualCompletion: row.actualCompletion?.slice(0,10)||'', status: row.status||'planned' }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.estimatedCost) payload.estimatedCost = Number(form.estimatedCost);
    if(form.actualCost) payload.actualCost = Number(form.actualCost);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'contractorName', label: 'Contractor', render: (r: any) => r.contractorName||'\u2014' },
    { key: 'estimatedCost', label: 'Est. Cost', render: (r: any) => r.estimatedCost?`\u20B9${r.estimatedCost.toLocaleString()}`:'\u2014' },
    { key: 'startDate', label: 'Start', render: (r: any) => r.startDate?.slice(0,10)||'\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status==='completed'?'success':r.status==='in_progress'?'info':r.status==='cancelled'?'danger':'warning'}>{r.status?.replace(/_/g,' ')}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Construction Projects</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending||updateMut.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{createMut.isPending||updateMut.isPending?'Saving...':editing?'Update':'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
