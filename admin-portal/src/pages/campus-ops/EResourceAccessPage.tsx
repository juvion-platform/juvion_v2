import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listEResourceAccesses, createEResourceAccess, updateEResourceAccess, deleteEResourceAccess, listEResources } from '../../services/campus-ops';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';


const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function EResourceAccessPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ eResourceId:'', personId:'', accessDate:'', duration:'' });

  const { data, isLoading } = useQuery({ queryKey: ['e-resource-accesses', page], queryFn: () => listEResourceAccesses(page, 20) });
  const { data: eResourcesData } = useQuery({ queryKey: ['eresources-ref','all'], queryFn: () => listEResources(1, 200) });
  const { data: personsData } = useQuery({ queryKey: ['persons-ref','all'], queryFn: () => listPersons(1, 200) });
  const eResources = eResourcesData?.items || [];
  const persons = personsData?.items || [];

  const createMut = useMutation({ mutationFn: createEResourceAccess, onSuccess: () => { qc.invalidateQueries({ queryKey: ['e-resource-accesses'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateEResourceAccess(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['e-resource-accesses'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteEResourceAccess, onSuccess: () => qc.invalidateQueries({ queryKey: ['e-resource-accesses'] }) });

  function openCreate() { setEditing(null); setForm({ eResourceId:'', personId:'', accessDate:'', duration:'' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ eResourceId: row.eResourceId?._id||row.eResourceId||'', personId: row.personId?._id||row.personId||'', accessDate: row.accessDate?.slice(0,10)||'', duration: String(row.duration??'') }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.duration) payload.duration = Number(form.duration);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'eResource', label: 'E-Resource', render: (r: any) => r.eResourceId?.title||'\u2014' },
    { key: 'person', label: 'Person', render: (r: any) => r.personId?.name||'\u2014' },
    { key: 'accessDate', label: 'Date', render: (r: any) => r.accessDate?.slice(0,10)||'\u2014' },
    { key: 'duration', label: 'Duration', render: (r: any) => r.duration?`${r.duration} min`:'\u2014' },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">E-Resource Access</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>E-Resource * <Link to="/campus-ops/e-resources" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select required value={form.eResourceId} onChange={e=>setForm(fm=>({...fm,eResourceId:e.target.value}))} className={inp}><option value="">Select...</option>{eResources.map((x:any)=><option key={x._id} value={x._id}>{x.title}</option>)}</select></div>
            <div><label className={lbl}>Person * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select required value={form.personId} onChange={e=>setForm(fm=>({...fm,personId:e.target.value}))} className={inp}><option value="">Select...</option>{persons.map((x:any)=><option key={x._id} value={x._id}>{x.name||x._id}</option>)}</select></div>
            <div><label className={lbl}>Access Date</label><input type="date" value={form.accessDate} onChange={e=>setForm(fm=>({...fm,accessDate:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Duration (min)</label><input type="number" min={0} value={form.duration} onChange={e=>setForm(fm=>({...fm,duration:e.target.value}))} className={inp}/></div>
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
