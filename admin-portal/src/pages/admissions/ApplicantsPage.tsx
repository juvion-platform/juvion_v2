import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listApplicants, createApplicant, updateApplicant } from '../../services/admissions';
import { listFeeQuotas } from '../../services/fee-quotas';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Eye, Phone, ChevronRight } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  draft: 'default', submitted: 'info', under_review: 'warning', eligible: 'success', ineligible: 'danger',
  offered: 'warning', accepted: 'success', fee_paid: 'success', enrolled: 'success', withdrawn: 'danger', rejected: 'danger',
};
const STATUSES = ['draft', 'submitted', 'under_review', 'eligible', 'ineligible', 'offered', 'accepted', 'fee_paid', 'enrolled', 'withdrawn', 'rejected'] as const;
const CATEGORIES = ['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC', 'ST', 'EWS'] as const;
const GENDERS = ['male', 'female', 'other'] as const;
const INTER_STREAMS = ['MPC', 'BiPC', 'MEC', 'CEC', 'other'] as const;

type Tab = 'personal' | 'academic' | 'programme' | 'exams' | 'status';

const emptyForm: any = {
  name: '', fatherName: '', phone: '', altPhone: '', email: '', gender: '', dateOfBirth: '', aadharNumber: '',
  address: '', city: '', state: '', district: '', pincode: '',
  tenthBoard: '', tenthSchool: '', tenthYear: '', tenthPercentage: '',
  interBoard: '', interCollege: '', interYear: '', interPercentage: '', interStream: '',
  programmeApplied: '', branchPreference1: '', branchPreference2: '', branchPreference3: '',
  quota: 'management', category: '',
  eamcetRank: '', eamcetScore: '', jeeRank: '', jeeScore: '', ecetRank: '', ecetScore: '',
  status: 'draft', notes: '',
};

export default function ApplicantsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [tab, setTab] = useState<Tab>('personal');

  const { data, isLoading } = useQuery({
    queryKey: ['applicants', page, filterStatus],
    queryFn: () => listApplicants(page, 20, filterStatus || undefined),
  });
  // FeeQuota catalog — drives the Quota dropdown so admins extending
  // the catalog (via /finance/fee-management/fee-quotas) see new
  // quotas immediately on the applicant form too.
  const { data: feeQuotas } = useQuery({
    queryKey: ['fee-quotas-all'],
    queryFn: () => listFeeQuotas(1, 100),
  });

  const createMut = useMutation({ mutationFn: createApplicant, onSuccess: () => { qc.invalidateQueries({ queryKey: ['applicants'] }); qc.invalidateQueries({ queryKey: ['admissions-stats'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateApplicant(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['applicants'] }); closeModal(); } });

  function openCreate() { setEditing(null); setForm({ ...emptyForm }); setTab('personal'); setModalOpen(true); }
  function openEdit(row: any) {
    setEditing(row);
    const f: any = {};
    Object.keys(emptyForm).forEach(k => { f[k] = row[k] != null ? String(row[k]) : ''; });
    if (row.dateOfBirth) f.dateOfBirth = row.dateOfBirth.substring(0, 10);
    setForm(f);
    setTab('personal');
    setModalOpen(true);
  }
  function openDetail(row: any) { setSelected(row); setDetailOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    // Convert numbers
    ['tenthYear', 'tenthPercentage', 'interYear', 'interPercentage', 'eamcetRank', 'eamcetScore', 'jeeRank', 'jeeScore', 'ecetRank', 'ecetScore'].forEach(k => {
      if (payload[k]) payload[k] = Number(payload[k]); else delete payload[k];
    });
    Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k]; });
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  // Status progression helper
  function nextStatus(current: string): string | null {
    const flow: Record<string, string> = {
      draft: 'submitted', submitted: 'under_review', under_review: 'eligible', eligible: 'offered', offered: 'accepted', accepted: 'fee_paid', fee_paid: 'enrolled',
    };
    return flow[current] || null;
  }

  function advanceStatus(row: any) {
    const next = nextStatus(row.status);
    if (next) updateMut.mutate({ id: row._id, data: { status: next } });
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'personal', label: 'Personal' },
    { key: 'academic', label: 'Academic' },
    { key: 'programme', label: 'Programme' },
    { key: 'exams', label: 'Entrance Exams' },
    { key: 'status', label: 'Status & Notes' },
  ];

  const inp = "w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
  const lbl = "block text-sm font-medium text-gray-700 mb-1";

  const columns = [
    { key: 'applicationNumber', label: 'App #', render: (r: any) => (
      <button onClick={(e) => { e.stopPropagation(); openDetail(r); }} className="text-left hover:text-primary-600 font-medium text-sm">{r.applicationNumber}</button>
    )},
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone', render: (r: any) => <span className="flex items-center gap-1 text-sm"><Phone size={12} className="text-green-500" />{r.phone}</span> },
    { key: 'programmeApplied', label: 'Programme', render: (r: any) => r.programmeApplied || '—' },
    { key: 'quota', label: 'Quota', render: (r: any) => <span className="capitalize text-sm">{r.quota}</span> },
    { key: 'category', label: 'Category', render: (r: any) => r.category || '—' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status]}>{r.status?.replace(/_/g, ' ')}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openDetail(r); }} className="p-1 rounded hover:bg-blue-50" title="View"><Eye size={15} className="text-blue-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        {nextStatus(r.status) && (
          <button onClick={(e) => { e.stopPropagation(); advanceStatus(r); }} className="p-1 rounded hover:bg-green-50" title={`Advance to ${nextStatus(r.status)?.replace(/_/g, ' ')}`}>
            <ChevronRight size={15} className="text-green-500" />
          </button>
        )}
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Applicants</h2>
        <div className="flex gap-3">
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> New Applicant
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Applicant' : 'New Applicant'}>
        <div className="flex gap-1 mb-4 border-b -mx-5 px-5">
          {tabs.map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {tab === 'personal' && (
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Father's Name</label><input value={form.fatherName} onChange={e => setForm((f: any) => ({ ...f, fatherName: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Phone *</label><input required value={form.phone} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Alt Phone</label><input value={form.altPhone} onChange={e => setForm((f: any) => ({ ...f, altPhone: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Email</label><input type="email" value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Gender</label><select value={form.gender} onChange={e => setForm((f: any) => ({ ...f, gender: e.target.value }))} className={inp}><option value="">Select...</option>{GENDERS.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
              <div><label className={lbl}>Date of Birth</label><input type="date" value={form.dateOfBirth} onChange={e => setForm((f: any) => ({ ...f, dateOfBirth: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Aadhar Number</label><input value={form.aadharNumber} onChange={e => setForm((f: any) => ({ ...f, aadharNumber: e.target.value }))} className={inp} maxLength={12} /></div>
              <div className="col-span-2"><label className={lbl}>Address</label><input value={form.address} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>City</label><input value={form.city} onChange={e => setForm((f: any) => ({ ...f, city: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>District</label><input value={form.district} onChange={e => setForm((f: any) => ({ ...f, district: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>State</label><input value={form.state} onChange={e => setForm((f: any) => ({ ...f, state: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Pincode</label><input value={form.pincode} onChange={e => setForm((f: any) => ({ ...f, pincode: e.target.value }))} className={inp} maxLength={6} /></div>
            </div>
          )}

          {tab === 'academic' && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-500">10th Class</h4>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={lbl}>Board</label><input value={form.tenthBoard} onChange={e => setForm((f: any) => ({ ...f, tenthBoard: e.target.value }))} className={inp} placeholder="e.g. SSC, CBSE" /></div>
                <div><label className={lbl}>School</label><input value={form.tenthSchool} onChange={e => setForm((f: any) => ({ ...f, tenthSchool: e.target.value }))} className={inp} /></div>
                <div><label className={lbl}>Year</label><input type="number" value={form.tenthYear} onChange={e => setForm((f: any) => ({ ...f, tenthYear: e.target.value }))} className={inp} /></div>
                <div><label className={lbl}>Percentage</label><input type="number" step="0.01" value={form.tenthPercentage} onChange={e => setForm((f: any) => ({ ...f, tenthPercentage: e.target.value }))} className={inp} /></div>
              </div>
              <h4 className="text-sm font-semibold text-gray-500 pt-2">Intermediate</h4>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={lbl}>Board</label><input value={form.interBoard} onChange={e => setForm((f: any) => ({ ...f, interBoard: e.target.value }))} className={inp} placeholder="e.g. BIE, CBSE" /></div>
                <div><label className={lbl}>College</label><input value={form.interCollege} onChange={e => setForm((f: any) => ({ ...f, interCollege: e.target.value }))} className={inp} /></div>
                <div><label className={lbl}>Year</label><input type="number" value={form.interYear} onChange={e => setForm((f: any) => ({ ...f, interYear: e.target.value }))} className={inp} /></div>
                <div><label className={lbl}>Percentage</label><input type="number" step="0.01" value={form.interPercentage} onChange={e => setForm((f: any) => ({ ...f, interPercentage: e.target.value }))} className={inp} /></div>
                <div><label className={lbl}>Stream</label><select value={form.interStream} onChange={e => setForm((f: any) => ({ ...f, interStream: e.target.value }))} className={inp}><option value="">Select...</option>{INTER_STREAMS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              </div>
            </div>
          )}

          {tab === 'programme' && (
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Programme *</label><input value={form.programmeApplied} onChange={e => setForm((f: any) => ({ ...f, programmeApplied: e.target.value }))} className={inp} placeholder="e.g. B.Tech" /></div>
              <div><label className={lbl}>Quota *</label>
                <select required value={form.quota} onChange={e => setForm((f: any) => ({ ...f, quota: e.target.value }))} className={inp}>
                  <option value="">Select quota</option>
                  {(feeQuotas?.items ?? [])
                    .filter((q: { status?: string }) => q.status !== 'inactive')
                    .map((q: { _id: string; code: string; name: string }) => (
                      <option key={q._id} value={q.code}>{q.code} — {q.name}</option>
                    ))}
                </select>
              </div>
              <div><label className={lbl}>Branch Pref 1</label><input value={form.branchPreference1} onChange={e => setForm((f: any) => ({ ...f, branchPreference1: e.target.value }))} className={inp} placeholder="e.g. CSE" /></div>
              <div><label className={lbl}>Category</label><select value={form.category} onChange={e => setForm((f: any) => ({ ...f, category: e.target.value }))} className={inp}><option value="">Select...</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label className={lbl}>Branch Pref 2</label><input value={form.branchPreference2} onChange={e => setForm((f: any) => ({ ...f, branchPreference2: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Branch Pref 3</label><input value={form.branchPreference3} onChange={e => setForm((f: any) => ({ ...f, branchPreference3: e.target.value }))} className={inp} /></div>
            </div>
          )}

          {tab === 'exams' && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-500">EAMCET</h4>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={lbl}>Rank</label><input type="number" value={form.eamcetRank} onChange={e => setForm((f: any) => ({ ...f, eamcetRank: e.target.value }))} className={inp} /></div>
                <div><label className={lbl}>Score</label><input type="number" value={form.eamcetScore} onChange={e => setForm((f: any) => ({ ...f, eamcetScore: e.target.value }))} className={inp} /></div>
              </div>
              <h4 className="text-sm font-semibold text-gray-500 pt-2">JEE</h4>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={lbl}>Rank</label><input type="number" value={form.jeeRank} onChange={e => setForm((f: any) => ({ ...f, jeeRank: e.target.value }))} className={inp} /></div>
                <div><label className={lbl}>Score</label><input type="number" value={form.jeeScore} onChange={e => setForm((f: any) => ({ ...f, jeeScore: e.target.value }))} className={inp} /></div>
              </div>
              <h4 className="text-sm font-semibold text-gray-500 pt-2">ECET</h4>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={lbl}>Rank</label><input type="number" value={form.ecetRank} onChange={e => setForm((f: any) => ({ ...f, ecetRank: e.target.value }))} className={inp} /></div>
                <div><label className={lbl}>Score</label><input type="number" value={form.ecetScore} onChange={e => setForm((f: any) => ({ ...f, ecetScore: e.target.value }))} className={inp} /></div>
              </div>
            </div>
          )}

          {tab === 'status' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Status</label>
                <select value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={lbl}>Notes</label>
                <textarea rows={3} value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} className={inp} />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              {createMut.isPending || updateMut.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Applicant Details">
        {selected && (
          <div className="space-y-4">
            {/* Status & App # */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-500 mr-2">{selected.applicationNumber}</span>
                <Badge variant={STATUS_COLOR[selected.status]}>{selected.status?.replace(/_/g, ' ')}</Badge>
              </div>
              {nextStatus(selected.status) && (
                <button onClick={() => { advanceStatus(selected); setDetailOpen(false); }} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
                  <ChevronRight size={14} className="text-white" /> Advance to {nextStatus(selected.status)?.replace(/_/g, ' ')}
                </button>
              )}
            </div>

            {/* Personal */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-500 mb-2">Personal Information</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Name:</span> <strong>{selected.name}</strong></div>
                {selected.fatherName && <div><span className="text-gray-500">Father:</span> {selected.fatherName}</div>}
                <div className="flex items-center gap-1"><Phone size={12} className="text-green-500" />{selected.phone}</div>
                {selected.email && <div>{selected.email}</div>}
                {selected.gender && <div><span className="text-gray-500">Gender:</span> <span className="capitalize">{selected.gender}</span></div>}
                {selected.aadharNumber && <div><span className="text-gray-500">Aadhar:</span> {selected.aadharNumber}</div>}
              </div>
              {(selected.city || selected.state) && (
                <p className="text-sm mt-2 text-gray-600">{[selected.address, selected.city, selected.district, selected.state, selected.pincode].filter(Boolean).join(', ')}</p>
              )}
            </div>

            {/* Academic */}
            {(selected.tenthPercentage || selected.interPercentage) && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-500 mb-2">Academic Background</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {selected.tenthPercentage && <div><span className="text-gray-500">10th:</span> {selected.tenthPercentage}% {selected.tenthBoard ? `(${selected.tenthBoard})` : ''}</div>}
                  {selected.interPercentage && <div><span className="text-gray-500">Inter:</span> {selected.interPercentage}% {selected.interStream ? `- ${selected.interStream}` : ''}</div>}
                </div>
              </div>
            )}

            {/* Programme & Exams */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-500 mb-2">Programme & Exams</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {selected.programmeApplied && <div><span className="text-gray-500">Programme:</span> {selected.programmeApplied}</div>}
                <div><span className="text-gray-500">Quota:</span> <span className="capitalize">{selected.quota}</span></div>
                {selected.category && <div><span className="text-gray-500">Category:</span> {selected.category}</div>}
                {selected.branchPreference1 && <div><span className="text-gray-500">Branch 1:</span> {selected.branchPreference1}</div>}
                {selected.eamcetRank && <div><span className="text-gray-500">EAMCET Rank:</span> {selected.eamcetRank}</div>}
                {selected.jeeRank && <div><span className="text-gray-500">JEE Rank:</span> {selected.jeeRank}</div>}
                {selected.ecetRank && <div><span className="text-gray-500">ECET Rank:</span> {selected.ecetRank}</div>}
              </div>
            </div>

            {selected.notes && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-500 mb-2">Notes</h4>
                <p className="text-sm text-gray-600">{selected.notes}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2 border-t">
              <button onClick={() => { setDetailOpen(false); openEdit(selected); }} className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
                <Pencil size={14} className="text-amber-500" /> Edit
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
