import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listBookReservations, createBookReservation, updateBookReservation, deleteBookReservation, listBooks } from '../../services/campus-ops';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function BookReservationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ bookId:'', reservedBy:'', reservedDate:'', expiryDate:'', status:'active' });

  const { data, isLoading } = useQuery({ queryKey: ['book-reservations', page], queryFn: () => listBookReservations(page, 20) });
  const { data: booksData } = useQuery({ queryKey: ['books-ref','all'], queryFn: () => listBooks(1, 200) });
  const { data: personsData } = useQuery({ queryKey: ['persons-ref','all'], queryFn: () => listPersons(1, 200) });
  const books = booksData?.items || [];
  const persons = personsData?.items || [];

  const createMut = useMutation({ mutationFn: createBookReservation, onSuccess: () => { qc.invalidateQueries({ queryKey: ['book-reservations'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateBookReservation(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['book-reservations'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteBookReservation, onSuccess: () => qc.invalidateQueries({ queryKey: ['book-reservations'] }) });

  function openCreate() { setEditing(null); setForm({ bookId:'', reservedBy:'', reservedDate:'', expiryDate:'', status:'active' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ bookId: row.bookId?._id||row.bookId||'', reservedBy: row.reservedBy?._id||row.reservedBy||'', reservedDate: row.reservedDate?.slice(0,10)||'', expiryDate: row.expiryDate?.slice(0,10)||'', status: row.status||'active' }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'book', label: 'Book', render: (r: any) => r.bookId?.title||'\u2014' },
    { key: 'reservedBy', label: 'Reserved By', render: (r: any) => r.reservedBy?.name||'\u2014' },
    { key: 'reservedDate', label: 'Date', render: (r: any) => r.reservedDate?.slice(0,10)||'\u2014' },
    { key: 'expiryDate', label: 'Expiry', render: (r: any) => r.expiryDate?.slice(0,10)||'\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status==='active'?'info':r.status==='fulfilled'?'success':r.status==='expired'?'danger':'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Book Reservations</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Book * <Link to="/campus-ops/books" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select required value={form.bookId} onChange={e=>setForm(fm=>({...fm,bookId:e.target.value}))} className={inp}><option value="">Select...</option>{books.map((x:any)=><option key={x._id} value={x._id}>{x.title}</option>)}</select></div>
            <div><label className={lbl}>Reserved By * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select required value={form.reservedBy} onChange={e=>setForm(fm=>({...fm,reservedBy:e.target.value}))} className={inp}><option value="">Select...</option>{persons.map((x:any)=><option key={x._id} value={x._id}>{x.name||x._id}</option>)}</select></div>
            <div><label className={lbl}>Reserved Date</label><input type="date" value={form.reservedDate} onChange={e=>setForm(fm=>({...fm,reservedDate:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Expiry Date</label><input type="date" value={form.expiryDate} onChange={e=>setForm(fm=>({...fm,expiryDate:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(fm=>({...fm,status:e.target.value}))} className={inp}><option value="">None</option><option value="active">active</option><option value="fulfilled">fulfilled</option><option value="expired">expired</option><option value="cancelled">cancelled</option></select></div>
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
