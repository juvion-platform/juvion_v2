import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLibraryFines, createLibraryFine, updateLibraryFine, deleteLibraryFine, listLibraryMembers, listBookIssues } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const REASON_OPTS = ['overdue','lost','damaged'] as const;
const STATUS_OPTS = ['pending','paid','waived'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function LibraryFinesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ memberId:'', bookIssueId:'', amount:'', reason:'overdue', paidAmount:'', status:'pending' });

  const { data, isLoading } = useQuery({ queryKey: ['library-fines', page], queryFn: () => listLibraryFines(page, 20) });
  const { data: membersData } = useQuery({ queryKey: ['libmembers-ref','all'], queryFn: () => listLibraryMembers(1, 200) });
  const { data: bookIssuesData } = useQuery({ queryKey: ['bookissues-ref','all'], queryFn: () => listBookIssues(1, 200) });
  const members = membersData?.items || [];
  const bookIssues = bookIssuesData?.items || [];

  const createMut = useMutation({ mutationFn: createLibraryFine, onSuccess: () => { qc.invalidateQueries({ queryKey: ['library-fines'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateLibraryFine(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['library-fines'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteLibraryFine, onSuccess: () => qc.invalidateQueries({ queryKey: ['library-fines'] }) });

  function openCreate() { setEditing(null); setForm({ memberId:'', bookIssueId:'', amount:'', reason:'overdue', paidAmount:'', status:'pending' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ memberId: row.memberId?._id||row.memberId||'', bookIssueId: row.bookIssueId?._id||row.bookIssueId||'', amount: String(row.amount??''), reason: row.reason||'overdue', paidAmount: String(row.paidAmount??''), status: row.status||'pending' }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.amount) payload.amount = Number(form.amount);
    if(form.paidAmount) payload.paidAmount = Number(form.paidAmount);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'member', label: 'Member', render: (r: any) => r.memberId?.membershipId||'\u2014' },
    { key: 'amount', label: 'Amount', render: (r: any) => `\u20B9${r.amount||0}` },
    { key: 'reason', label: 'Reason' },
    { key: 'paidAmount', label: 'Paid', render: (r: any) => `\u20B9${r.paidAmount||0}` },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status==='paid'?'success':r.status==='waived'?'info':'warning'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Library Fines</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Member * <Link to="/campus-ops/library-members" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select required value={form.memberId} onChange={e=>setForm(fm=>({...fm,memberId:e.target.value}))} className={inp}><option value="">Select...</option>{members.map((x:any)=><option key={x._id} value={x._id}>{x.membershipId}</option>)}</select></div>
            <div><label className={lbl}>Book Issue * <Link to="/campus-ops/book-issues" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select required value={form.bookIssueId} onChange={e=>setForm(fm=>({...fm,bookIssueId:e.target.value}))} className={inp}><option value="">Select...</option>{bookIssues.map((x:any)=><option key={x._id} value={x._id}>{`Issue #${x._id?.slice(-6)}`}</option>)}</select></div>
            <div><label className={lbl}>Amount *</label><input required type="number" min={0} value={form.amount} onChange={e=>setForm(fm=>({...fm,amount:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Reason *</label><select required value={form.reason} onChange={e=>setForm(fm=>({...fm,reason:e.target.value}))} className={inp}><option value="overdue">overdue</option><option value="lost">lost</option><option value="damaged">damaged</option></select></div>
            <div><label className={lbl}>Paid Amount</label><input type="number" min={0} value={form.paidAmount} onChange={e=>setForm(fm=>({...fm,paidAmount:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(fm=>({...fm,status:e.target.value}))} className={inp}><option value="">None</option><option value="pending">pending</option><option value="paid">paid</option><option value="waived">waived</option></select></div>
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
