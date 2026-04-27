import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Search, Trash2 } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import PersonThumbnail from '../../components/people/PersonThumbnail';
import { createParent, deleteParent, listParents, listStudents, updateParent } from '../../services/people';
import { useHighlightRow } from '../../hooks/useHighlightRow';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none transition-colors';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';
const manageLink = 'text-xs text-primary-600 hover:underline';

const emptyForm = {
  name: '',
  phone: '',
  alternatePhone: '',
  email: '',
  gender: '',
  dob: '',
  aadhaar: '',
  preferredLanguage: '',
  relationship: 'father',
  linkedStudents: [] as string[],
  primaryContact: false,
  occupation: '',
  employer: '',
  annualIncomeBand: '',
  isFeeResponsible: false,
  communicationPreference: 'call',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: '',
  biometricEnrolled: false,
};

const GENDERS = ['male', 'female', 'other'] as const;
const RELATIONSHIPS = ['father', 'mother', 'guardian'] as const;
const COMMUNICATION_PREFERENCES = ['call', 'sms', 'whatsapp', 'email'] as const;

export default function ParentsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['parents', page, search],
    queryFn: () => listParents(page, 20, search || undefined),
  });

  // Consume ?highlight=<personId> from global-people-search.
  const { highlightAttrs } = useHighlightRow({ ready: !isLoading && Boolean(data) });
  const { data: studentsData } = useQuery({
    queryKey: ['students-ref', 'all'],
    queryFn: () => listStudents(1, 200),
  });

  const studentOptions = studentsData?.items || [];
  const studentNameMap = useMemo(
    () => new Map(studentOptions.map((student: any) => [student._id, student.person?.name || student.personId?.name || student.rollNumber || student._id])),
    [studentOptions],
  );

  const createMut = useMutation({
    mutationFn: createParent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parents'] });
      qc.invalidateQueries({ queryKey: ['people-stats'] });
      closeModal();
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => updateParent(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parents'] });
      qc.invalidateQueries({ queryKey: ['people-stats'] });
      closeModal();
    },
  });
  const deleteMut = useMutation({
    mutationFn: deleteParent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parents'] });
      qc.invalidateQueries({ queryKey: ['people-stats'] });
    },
  });

  function closeModal() {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(row: any) {
    const person = row.person || row.personId || {};
    const address = person.address || {};
    const emergency = person.emergencyContact || {};
    setEditing(row);
    setForm({
      name: person.name || '',
      phone: person.phone || '',
      alternatePhone: person.alternatePhone || '',
      email: person.email || '',
      gender: person.gender || '',
      dob: person.dob ? person.dob.substring(0, 10) : '',
      aadhaar: person.aadhaar || '',
      preferredLanguage: person.preferredLanguage || '',
      relationship: row.relationship || 'father',
      linkedStudents: (row.linkedStudents || []).map((student: any) => typeof student === 'string' ? student : student._id),
      primaryContact: !!row.primaryContact,
      occupation: row.occupation || '',
      employer: row.employer || '',
      annualIncomeBand: row.annualIncomeBand || '',
      isFeeResponsible: !!row.isFeeResponsible,
      communicationPreference: row.communicationPreference || 'call',
      line1: address.line1 || '',
      line2: address.line2 || '',
      city: address.city || '',
      state: address.state || '',
      pincode: address.pincode || '',
      emergencyContactName: emergency.name || '',
      emergencyContactPhone: emergency.phone || '',
      emergencyContactRelationship: emergency.relationship || '',
      biometricEnrolled: !!person.biometricEnrolled,
    });
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    const address: any = {};
    ['line1', 'line2', 'city', 'state', 'pincode'].forEach(key => {
      if ((payload as any)[key]) address[key] = (payload as any)[key];
      delete (payload as any)[key];
    });
    if (Object.keys(address).length > 0) payload.address = address;
    const emergencyContact: any = {};
    if (payload.emergencyContactName) emergencyContact.name = payload.emergencyContactName;
    if (payload.emergencyContactPhone) emergencyContact.phone = payload.emergencyContactPhone;
    if (payload.emergencyContactRelationship) emergencyContact.relationship = payload.emergencyContactRelationship;
    delete payload.emergencyContactName;
    delete payload.emergencyContactPhone;
    delete payload.emergencyContactRelationship;
    if (Object.keys(emergencyContact).length > 0) payload.emergencyContact = emergencyContact;
    Object.keys(payload).forEach(key => {
      if (payload[key] === '') delete payload[key];
    });

    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;
  const error = createMut.error || updateMut.error;

  const columns = [
    { key: 'photo', label: '', render: (row: any) => {
      const name = row.person?.name || row.personId?.name || undefined;
      return <PersonThumbnail entityType="parents" entityId={row._id} personName={name} />;
    } },
    { key: 'name', label: 'Name', render: (row: any) => row.person?.name || row.personId?.name || '—' },
    { key: 'relationship', label: 'Relationship', render: (row: any) => <span className="capitalize">{row.relationship || '—'}</span> },
    { key: 'phone', label: 'Phone', render: (row: any) => row.person?.phone || row.personId?.phone || '—' },
    { key: 'students', label: 'Linked Students', render: (row: any) => {
      const linked = (row.linkedStudents || []).map((studentId: any) => studentNameMap.get(typeof studentId === 'string' ? studentId : studentId._id)).filter(Boolean);
      if (linked.length === 0) return '—';
      return <span>{linked.slice(0, 2).join(', ')}{linked.length > 2 ? ` +${linked.length - 2}` : ''}</span>;
    } },
    { key: 'profileCompleteness', label: 'Profile', render: (row: any) => {
      const score = row.profileCompleteness;
      if (!score) return '—';
      return (
        <div title={score.missing?.length ? `Missing: ${score.missing.join(', ')}` : 'Profile complete'}>
          <Badge variant={score.status === 'complete' ? 'success' : score.status === 'progressing' ? 'warning' : 'default'}>
            {score.percent}% complete
          </Badge>
        </div>
      );
    } },
    { key: 'primaryContact', label: 'Primary', render: (row: any) => row.primaryContact ? <Badge variant="success">Primary</Badge> : <span className="text-gray-400">No</span> },
    { key: 'fee', label: 'Fee Role', render: (row: any) => row.isFeeResponsible ? <Badge variant="info">Fee Responsible</Badge> : <span className="text-gray-400">—</span> },
    { key: 'actions', label: '', render: (row: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete parent profile?')) deleteMut.mutate(row._id); }} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    ) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Parents</h2>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
            <input placeholder="Search name..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 pr-3 py-2 border rounded-lg text-sm w-48" />
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> Add Parent
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        onRowClick={(r: any) => navigate(`/people/parents/${r._id}`)}
        rowKey={(r: any) => r._id}
        rowProps={(r: any) => highlightAttrs(r.person?._id ?? r.personId?._id)}
      />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={open} onClose={closeModal} title={editing ? 'Edit Parent' : 'New Parent'} widthClass="max-w-5xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {(error as any)?.response?.data?.error || (error as any)?.response?.data?.details?.map((d: any) => d.message).join(', ') || 'Something went wrong.'}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <section>
            <h3 className="font-semibold text-navy-dark mb-3">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Phone *</label><input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Alternate Phone</label><input value={form.alternatePhone} onChange={e => setForm(f => ({ ...f, alternatePhone: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Gender</label><select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} className={inp}><option value="">Select...</option>{GENDERS.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
              <div><label className={lbl}>Date of Birth</label><input type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Aadhaar</label><input value={form.aadhaar} onChange={e => setForm(f => ({ ...f, aadhaar: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Preferred Language</label><input value={form.preferredLanguage} onChange={e => setForm(f => ({ ...f, preferredLanguage: e.target.value }))} className={inp} /></div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 pt-7">
                <input type="checkbox" checked={form.biometricEnrolled} onChange={e => setForm(f => ({ ...f, biometricEnrolled: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                Biometric enrolled
              </label>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-navy-dark mb-3">Relationship & Responsibility</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className={lbl}>Relationship *</label><select required value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))} className={inp}>{RELATIONSHIPS.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
              <div><label className={lbl}>Occupation</label><input value={form.occupation} onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Employer</label><input value={form.employer} onChange={e => setForm(f => ({ ...f, employer: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Annual Income Band</label><input value={form.annualIncomeBand} onChange={e => setForm(f => ({ ...f, annualIncomeBand: e.target.value }))} className={inp} placeholder="e.g. 5L-10L" /></div>
              <div><label className={lbl}>Communication Preference</label><select value={form.communicationPreference} onChange={e => setForm(f => ({ ...f, communicationPreference: e.target.value }))} className={inp}>{COMMUNICATION_PREFERENCES.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 pt-7">
                <input type="checkbox" checked={form.primaryContact} onChange={e => setForm(f => ({ ...f, primaryContact: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                Primary contact
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 pt-7">
                <input type="checkbox" checked={form.isFeeResponsible} onChange={e => setForm(f => ({ ...f, isFeeResponsible: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                Fee responsible
              </label>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-navy-dark">Linked Students</h3>
              <Link to="/people/students" target="_blank" className={manageLink}>+ Manage</Link>
            </div>
            <select multiple value={form.linkedStudents} onChange={e => setForm(f => ({ ...f, linkedStudents: Array.from(e.target.selectedOptions).map(option => option.value) }))} className={`${inp} h-40`}>
              {studentOptions.map((student: any) => (
                <option key={student._id} value={student._id}>
                  {(student.person?.name || student.personId?.name || 'Student')} {student.rollNumber ? `(${student.rollNumber})` : ''}
                </option>
              ))}
            </select>
          </section>

          <section>
            <h3 className="font-semibold text-navy-dark mb-3">Address & Emergency Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2"><label className={lbl}>Address Line 1</label><input value={form.line1} onChange={e => setForm(f => ({ ...f, line1: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Address Line 2</label><input value={form.line2} onChange={e => setForm(f => ({ ...f, line2: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>City</label><input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>State</label><input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Pincode</label><input value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Emergency Contact Name</label><input value={form.emergencyContactName} onChange={e => setForm(f => ({ ...f, emergencyContactName: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Emergency Contact Phone</label><input value={form.emergencyContactPhone} onChange={e => setForm(f => ({ ...f, emergencyContactPhone: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Emergency Contact Relationship</label><input value={form.emergencyContactRelationship} onChange={e => setForm(f => ({ ...f, emergencyContactRelationship: e.target.value }))} className={inp} /></div>
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Saving...' : editing ? 'Update Parent' : 'Create Parent'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
