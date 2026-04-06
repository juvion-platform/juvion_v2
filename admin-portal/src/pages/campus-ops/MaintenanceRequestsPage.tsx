import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listMaintenanceRequests, createMaintenanceRequest, updateMaintenanceRequest, deleteMaintenanceRequest } from '../../services/campus-ops';
import { listPersons, listStaff } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const CATEGORY_OPTS = ['electrical','plumbing','carpentry','it','civil','cleaning','other'] as const;
const PRIORITY_OPTS = ['low','medium','high','emergency'] as const;
const STATUS_OPTS = ['open','assigned','in_progress','completed','rejected'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function MaintenanceRequestsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ requestedBy:'', category:'other', location:'', description:'', priority:'medium', assignedTo:'', status:'open', cost:'' });

  const { data, isLoading } = useQuery({ queryKey: ['maintenance-requests', page], queryFn: () => listMaintenanceRequests(page, 20) });
  const { data: personsData } = useQuery({ queryKey: ['persons-ref','all'], queryFn: () => listPersons(1, 200) });
  const { data: staffListData } = useQuery({ queryKey: ['staff-ref','all'], queryFn: () => listStaff(1, 200) });
  const persons = personsData?.items || [];
  const staffList = staffListData?.items || [];

  const createMut = useMutation({ mutationFn: createMaintenanceRequest, onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance-requests'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateMaintenanceRequest(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance-requests'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteMaintenanceRequest, onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance-requests'] }) });

  function openCreate() { setEditing(null); setForm({ requestedBy:'', category:'other', location:'', description:'', priority:'medium', assignedTo:'', status:'open', cost:'' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ requestedBy: row.requestedBy?._id||row.requestedBy||'', category: row.category||'other', location: row.location||'', description: row.description||'', priority: row.priority||'medium', assignedTo: row.assignedTo?._id||row.assignedTo||'', status: row.status||'open', cost: String(row.cost??'') }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.cost) payload.cost = Number(form.cost);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'category', label: 'Category', render: (r: any) => <span className="font-medium text-navy">{r.category}</span> },
    { key: 'location', label: 'Location' },
    { key: 'requestedBy', label: 'Requested By', render: (r: any) => r.requestedBy?.name||'\u2014' },
    { key: 'priority', label: 'Priority', render: (r: any) => <Badge variant={r.priority==='emergency'?'danger':r.priority==='high'?'warning':'default'}>{r.priority||'\u2014'}</Badge> },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status==='completed'?'success':r.status==='open'?'warning':'info'}>{r.status?.replace(/_/g,' ')}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Maintenance Requests</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Requested By * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select required value={form.requestedBy} onChange={e=>setForm(fm=>({...fm,requestedBy:e.target.value}))} className={inp}><option value="">Select...</option>{persons.map((x:any)=><option key={x._id} value={x._id}>{x.name||x._id}</option>)}</select></div>
            <div><label className={lbl}>Category *</label><select required value={form.category} onChange={e=>setForm(fm=>({...fm,category:e.target.value}))} className={inp}><option value="electrical">electrical</option><option value="plumbing">plumbing</option><option value="carpentry">carpentry</option><option value="it">it</option><option value="civil">civil</option><option value="cleaning">cleaning</option><option value="other">other</option></select></div>
            <div><label className={lbl}>Location *</label><input required value={form.location} onChange={e=>setForm(fm=>({...fm,location:e.target.value}))} className={inp}/></div>
            <div className="col-span-2"><label className={lbl}>Description *</label><textarea required value={form.description} onChange={e=>setForm(fm=>({...fm,description:e.target.value}))} className={inp} rows={3}/></div>
            <div><label className={lbl}>Priority</label><select value={form.priority} onChange={e=>setForm(fm=>({...fm,priority:e.target.value}))} className={inp}><option value="">None</option><option value="low">low</option><option value="medium">medium</option><option value="high">high</option><option value="emergency">emergency</option></select></div>
            <div><label className={lbl}>Assigned To <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select value={form.assignedTo} onChange={e=>setForm(fm=>({...fm,assignedTo:e.target.value}))} className={inp}><option value="">Select...</option>{staffList.map((x:any)=><option key={x._id} value={x._id}>{x.person?.name||x.employeeCode||x._id}</option>)}</select></div>
            <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(fm=>({...fm,status:e.target.value}))} className={inp}><option value="">None</option><option value="open">open</option><option value="assigned">assigned</option><option value="in_progress">in progress</option><option value="completed">completed</option><option value="rejected">rejected</option></select></div>
            <div><label className={lbl}>Cost</label><input type="number" min={0} value={form.cost} onChange={e=>setForm(fm=>({...fm,cost:e.target.value}))} className={inp}/></div>
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
