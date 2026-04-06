import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPurchaseOrders, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, listVendors } from '../../services/campus-ops';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_OPTS = ['draft','submitted','approved','ordered','delivered','cancelled'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ poNumber:'', vendorId:'', totalAmount:'', requestedBy:'', approvedBy:'', orderDate:'', expectedDelivery:'', status:'draft' });

  const { data, isLoading } = useQuery({ queryKey: ['purchase-orders', page], queryFn: () => listPurchaseOrders(page, 20) });
  const { data: vendorsData } = useQuery({ queryKey: ['vendors-ref','all'], queryFn: () => listVendors(1, 200) });
  const { data: personsData } = useQuery({ queryKey: ['persons-ref','all'], queryFn: () => listPersons(1, 200) });
  const vendors = vendorsData?.items || [];
  const persons = personsData?.items || [];

  const createMut = useMutation({ mutationFn: createPurchaseOrder, onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updatePurchaseOrder(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deletePurchaseOrder, onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }) });

  function openCreate() { setEditing(null); setForm({ poNumber:'', vendorId:'', totalAmount:'', requestedBy:'', approvedBy:'', orderDate:'', expectedDelivery:'', status:'draft' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ poNumber: row.poNumber||'', vendorId: row.vendorId?._id||row.vendorId||'', totalAmount: String(row.totalAmount??''), requestedBy: row.requestedBy?._id||row.requestedBy||'', approvedBy: row.approvedBy?._id||row.approvedBy||'', orderDate: row.orderDate?.slice(0,10)||'', expectedDelivery: row.expectedDelivery?.slice(0,10)||'', status: row.status||'draft' }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.totalAmount) payload.totalAmount = Number(form.totalAmount);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'poNumber', label: 'PO #', render: (r: any) => <span className="font-medium text-navy">{r.poNumber}</span> },
    { key: 'vendor', label: 'Vendor', render: (r: any) => r.vendorId?.name||'\u2014' },
    { key: 'totalAmount', label: 'Amount', render: (r: any) => `\u20B9${(r.totalAmount||0).toLocaleString()}` },
    { key: 'orderDate', label: 'Date', render: (r: any) => r.orderDate?.slice(0,10)||'\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status==='delivered'?'success':r.status==='cancelled'?'danger':'info'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Purchase Orders</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>PO Number *</label><input required value={form.poNumber} onChange={e=>setForm(fm=>({...fm,poNumber:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Vendor * <Link to="/campus-ops/vendors" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select required value={form.vendorId} onChange={e=>setForm(fm=>({...fm,vendorId:e.target.value}))} className={inp}><option value="">Select...</option>{vendors.map((x:any)=><option key={x._id} value={x._id}>{x.name}</option>)}</select></div>
            <div><label className={lbl}>Total Amount *</label><input required type="number" min={0} value={form.totalAmount} onChange={e=>setForm(fm=>({...fm,totalAmount:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Requested By * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select required value={form.requestedBy} onChange={e=>setForm(fm=>({...fm,requestedBy:e.target.value}))} className={inp}><option value="">Select...</option>{persons.map((x:any)=><option key={x._id} value={x._id}>{x.name||x._id}</option>)}</select></div>
            <div><label className={lbl}>Approved By <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select value={form.approvedBy} onChange={e=>setForm(fm=>({...fm,approvedBy:e.target.value}))} className={inp}><option value="">Select...</option>{persons.map((x:any)=><option key={x._id} value={x._id}>{x.name||x._id}</option>)}</select></div>
            <div><label className={lbl}>Order Date</label><input type="date" value={form.orderDate} onChange={e=>setForm(fm=>({...fm,orderDate:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Expected Delivery</label><input type="date" value={form.expectedDelivery} onChange={e=>setForm(fm=>({...fm,expectedDelivery:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(fm=>({...fm,status:e.target.value}))} className={inp}><option value="">None</option><option value="draft">draft</option><option value="submitted">submitted</option><option value="approved">approved</option><option value="ordered">ordered</option><option value="delivered">delivered</option><option value="cancelled">cancelled</option></select></div>
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
