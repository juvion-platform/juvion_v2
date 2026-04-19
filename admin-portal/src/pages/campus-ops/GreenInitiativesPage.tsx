import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listGreenInitiatives, createGreenInitiative, updateGreenInitiative, deleteGreenInitiative } from '../../services/campus-ops';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function GreenInitiativesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name:'', type:'solar', description:'', startDate:'', coordinatorId:'', status:'planned' });

  const { data, isLoading } = useQuery({ queryKey: ['green-initiatives', page], queryFn: () => listGreenInitiatives(page, 20) });
  const { data: personsData } = useQuery({ queryKey: ['persons-ref','all'], queryFn: () => listPersons(1, 200) });
  const persons = personsData?.items || [];

  const createMut = useMutation({ mutationFn: createGreenInitiative, onSuccess: () => { qc.invalidateQueries({ queryKey: ['green-initiatives'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateGreenInitiative(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['green-initiatives'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteGreenInitiative, onSuccess: () => qc.invalidateQueries({ queryKey: ['green-initiatives'] }) });

  function openCreate() { setEditing(null); setForm({ name:'', type:'solar', description:'', startDate:'', coordinatorId:'', status:'planned' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ name: row.name||'', type: row.type||'solar', description: row.description||'', startDate: row.startDate?.slice(0,10)||'', coordinatorId: row.coordinatorId?._id||row.coordinatorId||'', status: row.status||'planned' }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'type', label: 'Type', render: (r: any) => r.type?.replace(/_/g,' ') },
    { key: 'coordinator', label: 'Coordinator', render: (r: any) => r.coordinatorId?.name||'\u2014' },
    { key: 'startDate', label: 'Started', render: (r: any) => r.startDate?.slice(0,10)||'\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status==='active'?'success':r.status==='completed'?'info':'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Green Initiatives</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e=>setForm(fm=>({...fm,name:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Type *</label><select required value={form.type} onChange={e=>setForm(fm=>({...fm,type:e.target.value}))} className={inp}><option value="solar">solar</option><option value="rainwater_harvesting">rainwater harvesting</option><option value="waste_management">waste management</option><option value="tree_plantation">tree plantation</option><option value="energy_saving">energy saving</option><option value="other">other</option></select></div>
            <div className="col-span-2"><label className={lbl}>Description</label><textarea value={form.description} onChange={e=>setForm(fm=>({...fm,description:e.target.value}))} className={inp} rows={3}/></div>
            <div><label className={lbl}>Start Date</label><input type="date" value={form.startDate} onChange={e=>setForm(fm=>({...fm,startDate:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Coordinator <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select value={form.coordinatorId} onChange={e=>setForm(fm=>({...fm,coordinatorId:e.target.value}))} className={inp}><option value="">Select...</option>{persons.map((x:any)=><option key={x._id} value={x._id}>{x.name||x._id}</option>)}</select></div>
            <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(fm=>({...fm,status:e.target.value}))} className={inp}><option value="">None</option><option value="planned">planned</option><option value="active">active</option><option value="completed">completed</option></select></div>
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
