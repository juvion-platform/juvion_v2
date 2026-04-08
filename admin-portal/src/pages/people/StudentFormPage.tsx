import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStudent, createStudent, listParents, updateStudent } from '../../services/people';
import { listRegulations, listProgrammes, listBranches, listBatches } from '../../services/academics';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

const STATUSES = ['prospective', 'active', 'year_back', 'detained', 'graduated', 'exited', 'alumni'] as const;
const QUOTAS = ['convener', 'management', 'nri'] as const;
const GENDERS = ['male', 'female', 'other'] as const;
const ONBOARDING_STATUSES = ['not_started', 'in_progress', 'completed'] as const;

const emptyForm = {
  name: '', phone: '', alternatePhone: '', email: '', gender: '', dob: '', aadhaar: '', preferredLanguage: '',
  emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '', biometricEnrolled: false,
  admissionYear: new Date().getFullYear().toString(), category: '', quota: '', rollNumber: '',
  regulationId: '', programmeId: '', branchId: '', batchId: '',
  primaryParentId: '', feeResponsibleParentId: '',
  status: 'active',
  onboardingStatus: 'not_started',
  profileVerified: false,
  documentsVerified: false,
  feePlanConfirmed: false,
  portalAccessShared: false,
  idCardIssued: false,
  // Address
  line1: '', line2: '', city: '', state: '', pincode: '',
};

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none transition-colors";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function StudentFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['student', id],
    queryFn: () => getStudent(id!),
    enabled: isEdit,
  });

  const { data: regulationsData } = useQuery({ queryKey: ['regulations'], queryFn: () => listRegulations(1, 200) });
  const { data: programmesData } = useQuery({ queryKey: ['programmes'], queryFn: () => listProgrammes(1, 200) });
  const { data: branchesData } = useQuery({ queryKey: ['branches'], queryFn: () => listBranches(1, 200) });
  const { data: batchesData } = useQuery({ queryKey: ['batches'], queryFn: () => listBatches(1, 200) });
  const { data: parentsData } = useQuery({ queryKey: ['parents-ref', 'all'], queryFn: () => listParents(1, 200) });

  useEffect(() => {
    if (existing) {
      const p = existing.person || existing.personId || {};
      const addr = p.address || {};
      const emergency = p.emergencyContact || {};
      const checklist = existing.onboardingChecklist || {};
      setForm({
        name: p.name || '', phone: p.phone || '', alternatePhone: p.alternatePhone || '', email: p.email || '', gender: p.gender || '',
        dob: p.dob ? p.dob.substring(0, 10) : '', aadhaar: p.aadhaar || '',
        preferredLanguage: p.preferredLanguage || '',
        emergencyContactName: emergency.name || '',
        emergencyContactPhone: emergency.phone || '',
        emergencyContactRelationship: emergency.relationship || '',
        biometricEnrolled: !!p.biometricEnrolled,
        admissionYear: String(existing.admissionYear || ''), category: existing.category || '',
        quota: existing.quota || '', rollNumber: existing.rollNumber || '',
        regulationId: existing.regulationId?._id || existing.regulationId || '',
        programmeId: existing.programmeId?._id || existing.programmeId || '',
        branchId: existing.branchId?._id || existing.branchId || '',
        batchId: existing.batchId?._id || existing.batchId || '',
        primaryParentId: existing.primaryParentId?._id || existing.primaryParentId || '',
        feeResponsibleParentId: existing.feeResponsibleParentId?._id || existing.feeResponsibleParentId || '',
        status: existing.status || 'active',
        onboardingStatus: existing.onboardingStatus || 'not_started',
        profileVerified: !!checklist.profileVerified,
        documentsVerified: !!checklist.documentsVerified,
        feePlanConfirmed: !!checklist.feePlanConfirmed,
        portalAccessShared: !!checklist.portalAccessShared,
        idCardIssued: !!checklist.idCardIssued,
        line1: addr.line1 || '', line2: addr.line2 || '', city: addr.city || '',
        state: addr.state || '', pincode: addr.pincode || '',
      });
    }
  }, [existing]);

  const createMut = useMutation({
    mutationFn: createStudent,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['students'] }); qc.invalidateQueries({ queryKey: ['people-stats'] }); navigate('/people/students'); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => updateStudent(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['students'] }); qc.invalidateQueries({ queryKey: ['student', id] }); navigate('/people/students'); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, admissionYear: Number(form.admissionYear) };
    // Build address object
    const address: any = {};
    ['line1', 'line2', 'city', 'state', 'pincode'].forEach(k => { if ((payload as any)[k]) address[k] = (payload as any)[k]; delete (payload as any)[k]; });
    if (Object.keys(address).length > 0) payload.address = address;
    const emergencyContact: any = {};
    if (payload.emergencyContactName) emergencyContact.name = payload.emergencyContactName;
    if (payload.emergencyContactPhone) emergencyContact.phone = payload.emergencyContactPhone;
    if (payload.emergencyContactRelationship) emergencyContact.relationship = payload.emergencyContactRelationship;
    delete payload.emergencyContactName;
    delete payload.emergencyContactPhone;
    delete payload.emergencyContactRelationship;
    if (Object.keys(emergencyContact).length > 0) payload.emergencyContact = emergencyContact;
    payload.primaryParentId = payload.primaryParentId || null;
    payload.feeResponsibleParentId = payload.feeResponsibleParentId || null;
    payload.onboardingChecklist = {
      profileVerified: !!payload.profileVerified,
      documentsVerified: !!payload.documentsVerified,
      feePlanConfirmed: !!payload.feePlanConfirmed,
      portalAccessShared: !!payload.portalAccessShared,
      idCardIssued: !!payload.idCardIssued,
    };
    delete payload.profileVerified;
    delete payload.documentsVerified;
    delete payload.feePlanConfirmed;
    delete payload.portalAccessShared;
    delete payload.idCardIssued;
    Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k]; });
    if (isEdit) updateMut.mutate({ id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;
  const error = createMut.error || updateMut.error;

  if (isEdit && loadingExisting) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-gray-400" /></div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/people/students')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ArrowLeft size={20} className="text-gray-500" /></button>
          <div>
            <h2 className="text-xl font-bold text-navy">{isEdit ? 'Edit Student' : 'New Student'}</h2>
            {isEdit && existing && (
              <p className="text-sm text-gray-500 mt-0.5">{(existing.person || existing.personId)?.name} &middot; Roll: {existing.rollNumber || '—'}</p>
            )}
          </div>
        </div>
        <button type="submit" form="student-form" disabled={saving}
          className="flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} className="text-white" />}
          {saving ? 'Saving...' : isEdit ? 'Update Student' : 'Create Student'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {(error as any)?.response?.data?.error || (error as any)?.response?.data?.details?.map((d: any) => d.message).join(', ') || 'Something went wrong.'}
        </div>
      )}

      <form id="student-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <section className="bg-white rounded-xl border shadow-sm">
          <div className="px-5 py-4 border-b bg-navy/[0.03] rounded-t-xl">
            <h3 className="font-semibold text-navy-dark">Personal Information</h3>
            <p className="text-xs text-gray-500 mt-0.5">Basic identity and contact details</p>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className={lbl}>Name <span className="text-red-500">*</span></label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="Full name" /></div>
            <div><label className={lbl}>Phone <span className="text-red-500">*</span></label><input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inp} placeholder="10-digit mobile" /></div>
            <div><label className={lbl}>Alternate Phone</label><input value={form.alternatePhone} onChange={e => setForm(f => ({ ...f, alternatePhone: e.target.value }))} className={inp} placeholder="Backup contact number" /></div>
            <div><label className={lbl}>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Gender</label><select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} className={inp}><option value="">Select...</option>{GENDERS.map(g => <option key={g} value={g} className="capitalize">{g}</option>)}</select></div>
            <div><label className={lbl}>Date of Birth</label><input type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Aadhaar</label><input value={form.aadhaar} onChange={e => setForm(f => ({ ...f, aadhaar: e.target.value }))} className={inp} maxLength={12} placeholder="12-digit Aadhaar" /></div>
            <div><label className={lbl}>Preferred Language</label><input value={form.preferredLanguage} onChange={e => setForm(f => ({ ...f, preferredLanguage: e.target.value }))} className={inp} placeholder="e.g. English, Telugu" /></div>
            <div><label className={lbl}>Emergency Contact Name</label><input value={form.emergencyContactName} onChange={e => setForm(f => ({ ...f, emergencyContactName: e.target.value }))} className={inp} placeholder="Primary emergency contact" /></div>
            <div><label className={lbl}>Emergency Contact Phone</label><input value={form.emergencyContactPhone} onChange={e => setForm(f => ({ ...f, emergencyContactPhone: e.target.value }))} className={inp} placeholder="Emergency phone number" /></div>
            <div><label className={lbl}>Emergency Contact Relationship</label><input value={form.emergencyContactRelationship} onChange={e => setForm(f => ({ ...f, emergencyContactRelationship: e.target.value }))} className={inp} placeholder="e.g. Mother, Guardian" /></div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 pt-7">
              <input type="checkbox" checked={form.biometricEnrolled} onChange={e => setForm(f => ({ ...f, biometricEnrolled: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              Biometric enrolled
            </label>
          </div>
        </section>

        {/* Address */}
        <section className="bg-white rounded-xl border shadow-sm">
          <div className="px-5 py-4 border-b bg-navy/[0.03] rounded-t-xl">
            <h3 className="font-semibold text-navy-dark">Address</h3>
            <p className="text-xs text-gray-500 mt-0.5">Residential address</p>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2"><label className={lbl}>Address Line 1</label><input value={form.line1} onChange={e => setForm(f => ({ ...f, line1: e.target.value }))} className={inp} placeholder="House/Flat, Street" /></div>
            <div><label className={lbl}>Address Line 2</label><input value={form.line2} onChange={e => setForm(f => ({ ...f, line2: e.target.value }))} className={inp} placeholder="Area, Landmark" /></div>
            <div><label className={lbl}>City</label><input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>State</label><input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Pincode</label><input value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} className={inp} maxLength={6} /></div>
          </div>
        </section>

        {/* Academic Details */}
        <section className="bg-white rounded-xl border shadow-sm">
          <div className="px-5 py-4 border-b bg-navy/[0.03] rounded-t-xl">
            <h3 className="font-semibold text-navy-dark">Academic Details</h3>
            <p className="text-xs text-gray-500 mt-0.5">Enrollment and academic information</p>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className={lbl}>Admission Year <span className="text-red-500">*</span></label><input required type="number" value={form.admissionYear} onChange={e => setForm(f => ({ ...f, admissionYear: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Roll Number</label><input value={form.rollNumber} onChange={e => setForm(f => ({ ...f, rollNumber: e.target.value }))} className={inp} /></div>
            <div>
              <div className="flex items-center justify-between mb-1"><label className="text-sm font-medium text-gray-700">Regulation</label><Link to="/academics/regulations" className="text-xs text-primary-600 hover:underline">+ Manage</Link></div>
              <select value={form.regulationId} onChange={e => setForm(f => ({ ...f, regulationId: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {(regulationsData?.items || []).map((r: any) => <option key={r._id} value={r._id}>{r.code + ' - ' + r.name}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1"><label className="text-sm font-medium text-gray-700">Programme</label><Link to="/academics/programmes" className="text-xs text-primary-600 hover:underline">+ Manage</Link></div>
              <select value={form.programmeId} onChange={e => setForm(f => ({ ...f, programmeId: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {(programmesData?.items || []).map((p: any) => <option key={p._id} value={p._id}>{p.name || p.code}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1"><label className="text-sm font-medium text-gray-700">Branch</label><Link to="/academics/branches" className="text-xs text-primary-600 hover:underline">+ Manage</Link></div>
              <select value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {(branchesData?.items || []).map((b: any) => <option key={b._id} value={b._id}>{b.name || b.code}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1"><label className="text-sm font-medium text-gray-700">Batch</label><Link to="/academics/batches" className="text-xs text-primary-600 hover:underline">+ Manage</Link></div>
              <select value={form.batchId} onChange={e => setForm(f => ({ ...f, batchId: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {(batchesData?.items || []).map((bt: any) => <option key={bt._id} value={bt._id}>{bt.code || bt._id}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Quota</label><select value={form.quota} onChange={e => setForm(f => ({ ...f, quota: e.target.value }))} className={inp}><option value="">Select...</option>{QUOTAS.map(q => <option key={q} value={q} className="capitalize">{q}</option>)}</select></div>
            <div><label className={lbl}>Category</label><input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp} placeholder="e.g. OC, BC-A, SC, ST" /></div>
            <div><label className={lbl}>Status</label><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>{STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select></div>
          </div>
        </section>

        <section className="bg-white rounded-xl border shadow-sm">
          <div className="px-5 py-4 border-b bg-navy/[0.03] rounded-t-xl">
            <h3 className="font-semibold text-navy-dark">Guardian Linkage</h3>
            <p className="text-xs text-gray-500 mt-0.5">Map the student to the primary and fee-responsible guardian records</p>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1"><label className="text-sm font-medium text-gray-700">Primary Guardian</label><Link to="/people/parents" className="text-xs text-primary-600 hover:underline">+ Manage</Link></div>
              <select value={form.primaryParentId} onChange={e => setForm(f => ({ ...f, primaryParentId: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {(parentsData?.items || []).map((parent: any) => <option key={parent._id} value={parent._id}>{parent.person?.name || parent.personId?.name || parent._id} ({parent.relationship})</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1"><label className="text-sm font-medium text-gray-700">Fee Responsible Guardian</label><Link to="/people/parents" className="text-xs text-primary-600 hover:underline">+ Manage</Link></div>
              <select value={form.feeResponsibleParentId} onChange={e => setForm(f => ({ ...f, feeResponsibleParentId: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {(parentsData?.items || []).map((parent: any) => <option key={parent._id} value={parent._id}>{parent.person?.name || parent.personId?.name || parent._id} ({parent.relationship})</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border shadow-sm">
          <div className="px-5 py-4 border-b bg-navy/[0.03] rounded-t-xl">
            <h3 className="font-semibold text-navy-dark">Onboarding</h3>
            <p className="text-xs text-gray-500 mt-0.5">Track student onboarding readiness after admission</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={lbl}>Onboarding Status</label>
                <select value={form.onboardingStatus} onChange={e => setForm(f => ({ ...f, onboardingStatus: e.target.value }))} className={inp}>
                  {ONBOARDING_STATUSES.map(status => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={form.profileVerified} onChange={e => setForm(f => ({ ...f, profileVerified: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                Profile verified
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={form.documentsVerified} onChange={e => setForm(f => ({ ...f, documentsVerified: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                Documents verified
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={form.feePlanConfirmed} onChange={e => setForm(f => ({ ...f, feePlanConfirmed: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                Fee plan confirmed
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={form.portalAccessShared} onChange={e => setForm(f => ({ ...f, portalAccessShared: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                Portal access shared
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={form.idCardIssued} onChange={e => setForm(f => ({ ...f, idCardIssued: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                ID card issued
              </label>
            </div>
          </div>
        </section>

        {/* Bottom save */}
        <div className="flex justify-end">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} className="text-white" />}
            {saving ? 'Saving...' : isEdit ? 'Update Student' : 'Create Student'}
          </button>
        </div>
      </form>
    </div>
  );
}
