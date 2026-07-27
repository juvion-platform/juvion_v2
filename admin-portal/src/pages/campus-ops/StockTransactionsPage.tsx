import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listStockTransactions, createStockTransaction, updateStockTransaction, deleteStockTransaction, listStockItems } from '../../services/campus-ops';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { stockItemId:'', type:'in', quantity:'', doneBy:'', reference:'', remarks:'' };

export default function StockTransactionsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['stock-transactions', page, limit, search], queryFn: () => listStockTransactions(page, limit, search) });
  const { data: stockItemsData } = useQuery({ queryKey: ['stockitems-ref','all'], queryFn: () => listStockItems(1, 200) });
  const { data: personsData } = useQuery({ queryKey: ['persons-ref','all'], queryFn: () => listPersons(1, 200) });
  const stockItems = stockItemsData?.items || [];
  const persons = personsData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({ stockItemId: row.stockItemId?._id||row.stockItemId||'', type: row.type||'in', quantity: String(row.quantity??''), doneBy: row.doneBy?._id||row.doneBy||'', reference: row.reference||'', remarks: row.remarks||'' }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createStockTransaction, onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-transactions'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateStockTransaction(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-transactions'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteStockTransaction, onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-transactions'] }) });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.quantity) payload.quantity = Number(form.quantity);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'stockItem', label: 'Item', render: (r: any) => r.stockItemId?.name||'\u2014' },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant={r.type==='in'?'success':r.type==='out'?'warning':'info'}>{r.type}</Badge> },
    { key: 'quantity', label: 'Qty' },
    { key: 'doneBy', label: 'Done By', render: (r: any) => r.doneBy?.name||'\u2014' },
    { key: 'reference', label: 'Ref', render: (r: any) => r.reference||'\u2014' },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();vem.openForEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();void confirmAction({ title: 'Delete?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } })}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Stock Transactions</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search stock transactions…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No stock transactions match “${search}”.` : 'No stock transactions yet.'}
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
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Stock Transaction')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Stock Item * {!vem.isView && <Link to="/campus-ops/stock-items" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link>}</label><select required value={form.stockItemId} onChange={e=>setForm(fm=>({...fm,stockItemId:e.target.value}))} className={inp}><option value="">Select...</option>{stockItems.map((x:any)=><option key={x._id} value={x._id}>{x.name}</option>)}</select></div>
              <div><label className={lbl}>Type *</label><select required value={form.type} onChange={e=>setForm(fm=>({...fm,type:e.target.value}))} className={inp}><option value="in">in</option><option value="out">out</option><option value="adjustment">adjustment</option><option value="return">return</option></select></div>
              <div><label className={lbl}>Quantity *</label><input required type="number" min={0} value={form.quantity} onChange={e=>setForm(fm=>({...fm,quantity:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Done By * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link>}</label><select required value={form.doneBy} onChange={e=>setForm(fm=>({...fm,doneBy:e.target.value}))} className={inp}><option value="">Select...</option>{persons.map((x:any)=><option key={x._id} value={x._id}>{x.name||x._id}</option>)}</select></div>
              <div><label className={lbl}>Reference</label><input value={form.reference} onChange={e=>setForm(fm=>({...fm,reference:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Remarks</label><input value={form.remarks} onChange={e=>setForm(fm=>({...fm,remarks:e.target.value}))} className={inp}/></div>
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
