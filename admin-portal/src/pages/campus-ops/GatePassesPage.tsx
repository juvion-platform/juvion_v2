import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listGatePasses, createGatePass, updateGatePass, deleteGatePass } from '../../services/campus-ops';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const PERSONTYPE_OPTS = ['student','faculty','staff'] as const;
const TYPE_OPTS = ['half_day','full_day','emergency','night_out'] as const;
const STATUS_OPTS = ['requested','approved','rejected','active','returned'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function GatePassesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ personId:'', personType:'student', type:'half_day', reason:'', outTime:'', expectedInTime:'', status:'requested' });

  const { data, isLoading } = useQuery({ queryKey: ['gate-passes', page], queryFn: () => listGatePasses(page, 20) });
  const { data: personsData } = useQuery({ queryKey: ['persons-ref','all'], queryFn: () => listPersons(1, 200) });
  const persons = personsData?.items || [];

  const createMut = useMutation({ mutationFn: createGatePass, onSuccess: () => { qc.invalidateQueries({ queryKey: ['gate-passes'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateGatePass(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['gate-passes'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteGatePass, onSuccess: () => qc.invalidateQueries({ queryKey: ['gate-passes'] }) });

  function openCreate() { setEditing(null); setForm({ personId:'', personType:'student', type:'half_day', reason:'', outTime:'', expectedInTime:'', status:'requested' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ personId: row.personId?._id||row.personId||'', personType: row.personType||'student', type: row.type||'half_day', reason: row.reason||'', outTime: row.outTime?.slice(0,16)||'', expectedInTime: row.expectedInTime?.slice(0,16)||'', status: row.status||'requested' }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'person', label: 'Person', render: (r: any) => r.personId?.name||'\u2014' },
    { key: 'personType', label: 'Type' },
    { key: 'type', label: 'Pass', render: (r: any) => r.type?.replace(/_/g,' ') },
    { key: 'reason', label: 'Reason' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status==='approved'?'success':r.status==='rejected'?'danger':'warning'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Gate Passes</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Person * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select required value={form.personId} onChange={e=>setForm(fm=>({...fm,personId:e.target.value}))} className={inp}><option value="">Select...</option>{persons.map((x:any)=><option key={x._id} value={x._id}>{x.name||x._id}</option>)}</select></div>
            <div><label className={lbl}>Person Type *</label><select required value={form.personType} onChange={e=>setForm(fm=>({...fm,personType:e.target.value}))} className={inp}><option value="student">student</option><option value="faculty">faculty</option><option value="staff">staff</option></select></div>
            <div><label className={lbl}>Pass Type *</label><select required value={form.type} onChange={e=>setForm(fm=>({...fm,type:e.target.value}))} className={inp}><option value="half_day">half day</option><option value="full_day">full day</option><option value="emergency">emergency</option><option value="night_out">night out</option></select></div>
            <div><label className={lbl}>Reason *</label><input required value={form.reason} onChange={e=>setForm(fm=>({...fm,reason:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Out Time</label><input type="datetime-local" value={form.outTime} onChange={e=>setForm(fm=>({...fm,outTime:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Expected In</label><input type="datetime-local" value={form.expectedInTime} onChange={e=>setForm(fm=>({...fm,expectedInTime:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(fm=>({...fm,status:e.target.value}))} className={inp}><option value="">None</option><option value="requested">requested</option><option value="approved">approved</option><option value="rejected">rejected</option><option value="active">active</option><option value="returned">returned</option></select></div>
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
