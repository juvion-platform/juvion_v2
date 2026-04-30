import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStudent, createStudent, listParents, updateStudent } from '../../services/people';
import { listRegulations, listProgrammes, listBranches, listBatches } from '../../services/academics';
import { listFeeCategories } from '../../services/fee-categories';
import { getStudentPins, type IFeePin, type PopulatedFeeStructureInstance } from '../../services/fee-configuration';
import { ArrowLeft, Save, Loader2, AlertTriangle, CheckCircle2, ExternalLink, IndianRupee } from 'lucide-react';

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
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

/**
 * Shape of `feePin` returned by createStudent (backend service —
 * see `auto-pin matching fee structure on student enrollment`
 * commit). Soft-fail by design: when no matching FeeStructureInstance
 * exists, the student is still created and `feePin.success === false`
 * with a structured `reason` for the UI to surface.
 */
type FeePinNotice = {
  attempted: boolean;
  success: boolean;
  reason?: string;
  pinId?: string;
  feeStructureInstanceId?: string;
  yearOfStudy?: number;
};

/** Map a soft-fail reason to copy that helps the operator act on it. */
function pinNoticeCopy(reason: string | undefined): string {
  switch (reason) {
    case 'no-matching-fee-structure':
      return 'No matching fee structure was found for this student’s combination. Configure the structure in Finance › Fee Structures, then pin the student manually.';
    case 'no-academic-year':
      return 'No active academic year is set for this college. Set the current academic year and pin the student manually after.';
    case 'no-programme-id':
      return 'No programme was assigned, so no fee structure was pinned.';
    default:
      return reason ? `Auto-pin skipped: ${reason}` : 'Auto-pin did not complete.';
  }
}

/** Discriminated union covering both the create + edit auto-pin notices. */
type PinNoticeState =
  | { kind: 'soft-fail'; pin: FeePinNotice; studentId?: string }
  | { kind: 'success'; pin: FeePinNotice; studentId?: string }
  | { kind: 'fee-axis-changed'; studentId: string; changedFields: string[] };

/** Human-readable label for fee-axis fields surfaced in the post-edit banner. */
const FEE_AXIS_LABELS: Record<string, string> = {
  branchId: 'Branch',
  category: 'Category',
  quota: 'Quota',
};

export default function StudentFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [validationError, setValidationError] = useState('');
  /**
   * On successful create the backend returns a `feePin` field. If the
   * auto-pin succeeded we navigate immediately (current happy-path
   * behaviour). If it soft-failed (`attempted && !success`), we hold
   * the navigation, render an amber banner explaining what to do, and
   * let the operator click through.
   *
   * On successful update we additionally check whether any fee-axis
   * fields (branchId / category / quota) drifted vs the snapshot we
   * captured when the form first loaded. If they did, the backend
   * (per the existing T11 stale-pin detection) will have just marked
   * the active pin staleSince — we mirror that here with a banner and
   * a deep-link to the student detail page where FeePinsPanel handles
   * the manual re-pin.
   */
  const [pinNotice, setPinNotice] = useState<PinNoticeState | null>(null);
  /**
   * Snapshot of the fee-axis fields at form-load time (edit mode only).
   * Captured ONCE in the same effect that hydrates `form` from the
   * fetched `existing` student. Used both to render a pre-save info
   * notice when the operator touches one of these fields, and to
   * decide whether to hold the post-save navigation.
   */
  const [initialFeeAxes, setInitialFeeAxes] = useState<{ branchId: string; category: string; quota: string } | null>(null);

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
  // Same FeeCategory catalog the FeeStructures form pulls from. Keeping the
  // student.category dropdown sourced from this list prevents the typo class
  // of "OC" vs "oc" that would silently break fee-pin matching downstream.
  const { data: feeCategoriesData } = useQuery({ queryKey: ['fee-categories-all'], queryFn: () => listFeeCategories(1, 100) });
  // Edit mode only — pull the active fee pin + populated FSI so we can show
  // the operator the CURRENT pinned fee structure inline. Same query key as
  // <FeePinsPanel />, so React Query dedupes if the user lands here from
  // the detail page.
  const { data: pinsData } = useQuery({
    queryKey: ['student-pins', id],
    queryFn: () => getStudentPins(id!),
    enabled: isEdit,
  });

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
      // Snapshot fee-axis fields so we can detect drift later. Done in
      // the same effect so the snapshot is a faithful copy of what's in
      // the form on first paint.
      setInitialFeeAxes({
        branchId: existing.branchId?._id || existing.branchId || '',
        category: existing.category || '',
        quota: existing.quota || '',
      });
    }
  }, [existing]);

  /**
   * Active fee pin (most recent non-archived) + the populated
   * FeeStructureInstance behind it. Computed once per pinsData refresh
   * so the Academic Details fee-summary card has a stable reference.
   * Helpers are inlined (tiny, shared with StudentDetailPage's drift
   * indicator).
   */
  const activePin: IFeePin | undefined = (() => {
    const pins = pinsData?.pins ?? [];
    const live = pins.filter((p) => !p.archivedAt);
    if (live.length === 0) return undefined;
    return [...live].sort((a, b) => (b.yearOfStudy ?? 0) - (a.yearOfStudy ?? 0))[0];
  })();
  const activePinFsi: PopulatedFeeStructureInstance | undefined = (() => {
    if (!activePin) return undefined;
    const f = activePin.feeStructureInstanceId;
    return typeof f === 'object' && f !== null ? f : undefined;
  })();

  /**
   * Pre-save hint. Computes which of the 3 fee-axis fields drifted
   * vs `initialFeeAxes`. Empty list when nothing changed (or in
   * create mode where there's no snapshot).
   */
  const changedFeeAxes: string[] = (() => {
    if (!initialFeeAxes) return [];
    const out: string[] = [];
    if (form.branchId !== initialFeeAxes.branchId) out.push('branchId');
    if (form.category !== initialFeeAxes.category) out.push('category');
    if (form.quota !== initialFeeAxes.quota) out.push('quota');
    return out;
  })();
  const willTriggerStalePin = isEdit && changedFeeAxes.length > 0;

  const createMut = useMutation({
    mutationFn: createStudent,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['people-stats'] });
      const pin = data?.feePin as FeePinNotice | undefined;
      // Hold navigation when the auto-pin was attempted and soft-failed
      // — the operator needs to know there's a follow-up before leaving
      // this page. Happy path (success or "skipped, no programmeId")
      // navigates immediately as before.
      if (pin?.attempted && pin.success === false) {
        setPinNotice({ kind: 'soft-fail', pin, studentId: data?._id });
        return;
      }
      navigate('/people/students');
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => updateStudent(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['student', id] });
      // Mirror create flow: if a fee-axis (branch / category / quota)
      // changed, the backend has just marked the active pin stale. Hold
      // navigation and surface the prompt so the operator routes to the
      // detail page to re-pin.
      if (id && changedFeeAxes.length > 0) {
        setPinNotice({ kind: 'fee-axis-changed', studentId: id, changedFields: changedFeeAxes });
        return;
      }
      navigate('/people/students');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError('');

    const checklistComplete = [
      form.profileVerified,
      form.documentsVerified,
      form.feePlanConfirmed,
      form.portalAccessShared,
      form.idCardIssued,
    ].every(Boolean);

    if (form.onboardingStatus === 'completed') {
      if (!form.feeResponsibleParentId) {
        setValidationError('Fee responsible guardian is required before onboarding can be marked completed.');
        return;
      }
      if (!checklistComplete) {
        setValidationError('Complete the onboarding checklist before marking onboarding completed.');
        return;
      }
    }

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

      {(validationError || error) && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {validationError || (error as any)?.response?.data?.error || (error as any)?.response?.data?.details?.map((d: any) => d.message).join(', ') || 'Something went wrong.'}
        </div>
      )}

      {willTriggerStalePin && !pinNotice && (
        <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              You changed{' '}
              <span className="font-semibold">
                {changedFeeAxes.map((f) => FEE_AXIS_LABELS[f] ?? f).join(', ')}
              </span>{' '}
              — saving will mark the current fee pin stale. You'll be prompted to re-pin
              the student's fee structure on the next page.
            </div>
          </div>
        </div>
      )}

      {pinNotice && pinNotice.kind === 'fee-axis-changed' && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-amber-900">
                Fee structure may need re-pinning.
              </p>
              <p className="text-amber-800 mt-1">
                You changed{' '}
                <span className="font-semibold">
                  {pinNotice.changedFields.map((f) => FEE_AXIS_LABELS[f] ?? f).join(', ')}
                </span>{' '}
                — the current fee pin no longer matches the student's attributes and has
                been flagged stale. Open the student to review the pin and apply the
                matching fee structure.
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  to={`/people/students/${pinNotice.studentId}`}
                  className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-md hover:bg-amber-700"
                >
                  Open student to re-pin
                </Link>
                <button
                  type="button"
                  onClick={() => navigate('/people/students')}
                  className="px-3 py-1.5 bg-white text-amber-800 text-xs font-medium rounded-md border border-amber-300 hover:bg-amber-100"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pinNotice && pinNotice.kind === 'soft-fail' && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-amber-900">Student created, but no fee structure was pinned.</p>
              <p className="text-amber-800 mt-1">{pinNoticeCopy(pinNotice.pin.reason)}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/people/students')}
                  className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-md hover:bg-amber-700"
                >
                  Continue to Students
                </button>
                {pinNotice.studentId && (
                  <Link
                    to={`/people/students/${pinNotice.studentId}`}
                    className="px-3 py-1.5 bg-white text-amber-800 text-xs font-medium rounded-md border border-amber-300 hover:bg-amber-100"
                  >
                    Open student
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {pinNotice && pinNotice.kind === 'success' && (
        <div role="status" className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3">
          <div className="flex items-center gap-2 text-sm text-green-800">
            <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
            <span>Fee structure pinned for Year {pinNotice.pin.yearOfStudy ?? 1}.</span>
          </div>
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
          {/* Current-pin context strip. Edit mode only, when a pin exists.
              Shows the operator the CURRENT pinned fee structure so they
              know what they're about to drift from when changing branch /
              category / quota. Sits ABOVE the input grid so the reference
              is visible while editing. */}
          {isEdit && activePin && activePinFsi && (
            <div className="px-5 pt-4 pb-1">
              <div className={`rounded-lg border ${willTriggerStalePin ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'} p-3 text-sm`}>
                <div className="flex items-start gap-2">
                  <IndianRupee size={14} className={`mt-0.5 ${willTriggerStalePin ? 'text-amber-600' : 'text-slate-500'} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${willTriggerStalePin ? 'text-amber-900' : 'text-slate-700'}`}>
                      Current fee structure (Year {activePin.yearOfStudy})
                      {willTriggerStalePin && (
                        <span className="ml-2 text-xs font-normal text-amber-700">
                          — saving will mark this stale
                        </span>
                      )}
                    </div>
                    <div className={`text-xs mt-0.5 ${willTriggerStalePin ? 'text-amber-800' : 'text-slate-600'}`}>
                      <span className="font-semibold">{activePinFsi.name ?? activePinFsi.code ?? 'Fee Structure'}</span>
                      <span className="mx-2">·</span>
                      <span className="font-bold">
                        {`₹${(activePinFsi.totalAmount ?? 0).toLocaleString('en-IN')}`}
                      </span>
                    </div>
                    <div className={`text-xs mt-1 ${willTriggerStalePin ? 'text-amber-800' : 'text-slate-500'}`}>
                      Quota:{' '}
                      <span className="font-mono">{activePinFsi.quota ?? 'any'}</span>
                      <span className="mx-1.5">·</span>
                      Category:{' '}
                      <span className="font-mono">{activePinFsi.category ?? 'any'}</span>
                      <span className="mx-1.5">·</span>
                      Branch:{' '}
                      <span className="font-mono">
                        {typeof activePinFsi.branchId === 'object' && activePinFsi.branchId
                          ? (activePinFsi.branchId.name ?? '<set>')
                          : activePinFsi.branchId
                          ? '<set>'
                          : 'any'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
            <div>
              <label className={lbl}>
                Category
                <Link to="/finance/fee-management/fee-categories" target="_blank" className={manageLink}>
                  + Manage <ExternalLink size={10} />
                </Link>
              </label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                <option value="">Select category</option>
                {(feeCategoriesData?.items ?? [])
                  .filter((c: { status?: string }) => c.status !== 'inactive')
                  .map((c: { _id: string; code: string; name: string }) => (
                    <option key={c._id} value={c.code}>{c.code} — {c.name}</option>
                  ))}
              </select>
            </div>
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
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Onboarding can be marked completed only after a fee responsible guardian is linked and every checklist item is done.
            </div>
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
