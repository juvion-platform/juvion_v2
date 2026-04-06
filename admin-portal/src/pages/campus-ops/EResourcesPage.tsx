import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listEResources, createEResource, updateEResource, deleteEResource } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const TYPE_OPTS = ['e_journal','e_book','database','video_lecture','nptel','mooc'] as const;
const ACCESSTYPE_OPTS = ['open','subscribed','institutional'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";


export default function EResourcesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title:'', type:'e_journal', provider:'', url:'', accessType:'open', subscriptionStart:'', subscriptionEnd:'', isActive:true });

  const { data, isLoading } = useQuery({ queryKey: ['e-resources', page], queryFn: () => listEResources(page, 20) });

  const createMut = useMutation({ mutationFn: createEResource, onSuccess: () => { qc.invalidateQueries({ queryKey: ['e-resources'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateEResource(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['e-resources'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteEResource, onSuccess: () => qc.invalidateQueries({ queryKey: ['e-resources'] }) });

  function openCreate() { setEditing(null); setForm({ title:'', type:'e_journal', provider:'', url:'', accessType:'open', subscriptionStart:'', subscriptionEnd:'', isActive:true }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ title: row.title||'', type: row.type||'e_journal', provider: row.provider||'', url: row.url||'', accessType: row.accessType||'open', subscriptionStart: row.subscriptionStart?.slice(0,10)||'', subscriptionEnd: row.subscriptionEnd?.slice(0,10)||'', isActive: row.isActive!==false }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium text-navy">{r.title}</span> },
    { key: 'type', label: 'Type', render: (r: any) => r.type?.replace(/_/g,' ') },
    { key: 'provider', label: 'Provider', render: (r: any) => r.provider||'\u2014' },
    { key: 'accessType', label: 'Access', render: (r: any) => r.accessType||'\u2014' },
    { key: 'isActive', label: 'Active', render: (r: any) => <Badge variant={r.isActive!==false?'success':'default'}>{r.isActive!==false?'Yes':'No'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">E-Resources</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Title *</label><input required value={form.title} onChange={e=>setForm(fm=>({...fm,title:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Type *</label><select required value={form.type} onChange={e=>setForm(fm=>({...fm,type:e.target.value}))} className={inp}><option value="e_journal">e journal</option><option value="e_book">e book</option><option value="database">database</option><option value="video_lecture">video lecture</option><option value="nptel">nptel</option><option value="mooc">mooc</option></select></div>
            <div><label className={lbl}>Provider</label><input value={form.provider} onChange={e=>setForm(fm=>({...fm,provider:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>URL</label><input value={form.url} onChange={e=>setForm(fm=>({...fm,url:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Access Type</label><select value={form.accessType} onChange={e=>setForm(fm=>({...fm,accessType:e.target.value}))} className={inp}><option value="">None</option><option value="open">open</option><option value="subscribed">subscribed</option><option value="institutional">institutional</option></select></div>
            <div><label className={lbl}>Sub. Start</label><input type="date" value={form.subscriptionStart} onChange={e=>setForm(fm=>({...fm,subscriptionStart:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Sub. End</label><input type="date" value={form.subscriptionEnd} onChange={e=>setForm(fm=>({...fm,subscriptionEnd:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Active</label><select value={String(form.isActive)} onChange={e=>setForm(fm=>({...fm,isActive:e.target.value==='true'}))} className={inp}><option value="true">Yes</option><option value="false">No</option></select></div>
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
