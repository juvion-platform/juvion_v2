import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStudent, createStudent, listParents, updateStudent } from '../../services/people';
import { listRegulations, listProgrammes, listBranches, listBatches } from '../../services/academics';
import { listFeeCategories } from '../../services/fee-categories';
import { listFeeQuotas } from '../../services/fee-quotas';
import {
  getStudentPins,
  previewMatchingFeeStructure,
  listFeeComponents,
  type IFeePin,
  type PopulatedFeeStructureInstance,
  type IFeeComponent,
} from '../../services/fee-configuration';
import { ArrowLeft, Save, Loader2, AlertTriangle, CheckCircle2, ExternalLink, IndianRupee } from 'lucide-react';

const STATUSES = ['prospective', 'active', 'year_back', 'detained', 'graduated', 'exited', 'alumni'] as const;
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
  | { kind: 'fee-axis-changed'; studentId: string; changedFields: string[] }
  /** Auto-rebind succeeded on save — new pin already applied, brief green toast. */
  | { kind: 'rebind-success'; studentId: string; changedFields: string[]; yearOfStudy?: number };

/**
 * Form tab keys. Mirrors the Profile / Academic split on
 * StudentDetailPage so the create + edit and view experiences feel
 * like the same surface. We don't have a "Fees" tab on the form
 * because fee pinning is read-only here — the inline current-fee
 * strip on the Academic tab is enough context for the operator.
 */
type FormTabKey = 'profile' | 'academic';
interface FormTab {
  key: FormTabKey;
  label: string;
}
const FORM_TABS: ReadonlyArray<FormTab> = [
  { key: 'profile', label: 'Profile' },
  { key: 'academic', label: 'Academic Details' },
];

/** Human-readable label for fee-axis fields surfaced in the post-edit banner. */
const FEE_AXIS_LABELS: Record<string, string> = {
  branchId: 'Branch',
  category: 'Category',
  quota: 'Quota',
};

/**
 * Compact component-breakdown table rendered inline inside a fee-strip.
 * One row per FeeComponent: name (with a "Refundable" pill where
 * applicable) and the rupee amount, right-aligned. The footer row
 * shows the sum so operators can sanity-check it against the headline
 * total.
 *
 * `palette` keys mirror the parent strip's theme so the table blends
 * in (slate / blue / emerald). When the parent has no components yet
 * we render a one-liner empty state instead — avoids a confusing blank
 * gap below the headline total.
 */
function ComponentBreakdown({
  components,
  palette,
}: {
  components: IFeeComponent[];
  palette: { sub: string; body: string; row: string; pill: string };
}) {
  if (components.length === 0) {
    return (
      <div className={`mt-2 text-xs italic ${palette.sub}`}>
        No component breakdown configured — only the total amount is set.
      </div>
    );
  }
  const sum = components.reduce((s, c) => s + (c.amount || 0), 0);
  return (
    <div className={`mt-2 rounded border ${palette.row} divide-y text-xs`}>
      {components.map((c) => (
        <div key={c._id} className="flex items-center justify-between px-2 py-1">
          <div className={`${palette.body} flex items-center gap-1.5`}>
            <span className="font-medium">{c.name}</span>
            {c.isRefundable && (
              <span className={`text-[10px] uppercase tracking-wide font-medium px-1 rounded ${palette.pill}`}>
                refundable
              </span>
            )}
          </div>
          <div className={`${palette.body} font-mono tabular-nums`}>
            {`₹${(c.amount ?? 0).toLocaleString('en-IN')}`}
          </div>
        </div>
      ))}
      <div className={`flex items-center justify-between px-2 py-1 ${palette.sub} font-semibold`}>
        <div>Total</div>
        <div className="font-mono tabular-nums">
          {`₹${sum.toLocaleString('en-IN')}`}
        </div>
      </div>
    </div>
  );
}

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
  /**
   * Active tab. Profile is the default landing surface — the most
   * common edit is changing identity / lifecycle fields. Operators
   * who came here specifically to change fee-axis fields can flip to
   * Academic Details in one click.
   */
  const [formTab, setFormTab] = useState<FormTabKey>('profile');

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
  // Same FeeQuota catalog the FeeStructures form pulls from. Keeping the
  // student.quota dropdown sourced from CRUD lets admins extend the
  // catalog (e.g. add 'spot' or a custom quota) without touching code.
  const { data: feeQuotasData } = useQuery({ queryKey: ['fee-quotas-all'], queryFn: () => listFeeQuotas(1, 100) });
  // Edit mode only — pull the active fee pin + populated FSI so we can show
  // the operator the CURRENT pinned fee structure inline. Same query key as
  // <FeePinsPanel />, so React Query dedupes if the user lands here from
  // the detail page.
  const { data: pinsData } = useQuery({
    queryKey: ['student-pins', id],
    queryFn: () => getStudentPins(id!),
    enabled: isEdit,
  });

  // Active pin + populated FSI. Hoisted above the preview / component
  // queries below so they can reference `activePinFsi` for the
  // "matches current pin" comparison and for fetching the breakdown
  // of the currently-pinned FSI. Helpers inlined (tiny, shared with
  // StudentDetailPage's drift indicator).
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

  // Live "matching fee structure" preview. Re-fetches whenever any of
  // the fee-axis fields the resolver scores against change. Disabled
  // until the operator picks a programme — without one the resolver
  // returns null anyway. Returns the FSI that *would* be pinned on
  // save; null means no match exists for the current combination.
  const previewYearOfStudy = (() => {
    // Edit mode: prefer the current active pin's yearOfStudy so the
    // preview is anchored to the right academic year.
    if (isEdit && pinsData?.pins?.length) {
      const live = pinsData.pins.filter((p) => !p.archivedAt);
      if (live.length > 0) {
        return [...live].sort((a, b) => (b.yearOfStudy ?? 0) - (a.yearOfStudy ?? 0))[0]!.yearOfStudy ?? 1;
      }
    }
    return 1;
  })();
  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: [
      'fee-preview',
      form.programmeId,
      form.branchId || null,
      form.quota || null,
      form.category || null,
      previewYearOfStudy,
    ],
    queryFn: () =>
      previewMatchingFeeStructure({
        programmeId: form.programmeId,
        branchId: form.branchId || null,
        quota: form.quota || null,
        category: form.category || null,
        yearOfStudy: previewYearOfStudy,
      }),
    enabled: !!form.programmeId,
    // Preview is "fresh enough" for 30s — operators rarely toggle a
    // field many times in a few seconds, and FSIs don't churn often.
    staleTime: 30_000,
  });
  const previewFsi = previewData?.matched ? previewData.fsi : null;
  // True iff the preview's FSI differs from the currently pinned FSI.
  // Used to colour the strip — if the preview matches the current pin
  // it's reassuring (green/blue), else it's a "this is what would
  // change" notice (amber when fee-axis fields have drifted).

  // Fetch component breakdown for the current pinned FSI and the
  // preview FSI. Two separate queries so React Query can cache each
  // independently — when the preview's FSI matches the current pin
  // the second query is a cache hit and re-uses the first's data.
  const currentPinFsiId = activePinFsi?._id;
  const previewFsiId = previewFsi?._id;
  const { data: currentComponentsData } = useQuery({
    queryKey: ['fee-components', currentPinFsiId],
    queryFn: () => listFeeComponents(currentPinFsiId!),
    enabled: !!currentPinFsiId,
    staleTime: 60_000,
  });
  const { data: previewComponentsData } = useQuery({
    queryKey: ['fee-components', previewFsiId],
    queryFn: () => listFeeComponents(previewFsiId!),
    enabled: !!previewFsiId,
    staleTime: 60_000,
  });
  const currentComponents = currentComponentsData?.items ?? [];
  const previewComponents = previewComponentsData?.items ?? [];

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
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['student', id] });
      qc.invalidateQueries({ queryKey: ['student-pins', id] });

      // Read the feePinUpdate payload the backend now returns on every
      // student update. Three outcomes when feeAxisChanged:
      //
      //   autoRebound = true  → matching FSI found and applied automatically
      //                          → green toast, then auto-navigate.
      //
      //   pinMarkedStale = true → no matching FSI found; old pin flagged
      //                           → amber prompt to re-pin manually.
      //
      //   neither             → no fee-axis field changed; navigate silently.
      type FeePinUpdate = {
        feeAxisChanged?: boolean;
        autoRebound?: boolean;
        newPinId?: string;
        yearOfStudy?: number;
        pinMarkedStale?: boolean;
        reason?: string;
      };
      const fpu = (data as { feePinUpdate?: FeePinUpdate } | undefined)?.feePinUpdate;

      if (fpu?.feeAxisChanged) {
        if (fpu.autoRebound) {
          setPinNotice({
            kind: 'rebind-success',
            studentId: id!,
            changedFields: changedFeeAxes,
            yearOfStudy: fpu.yearOfStudy,
          });
          // Auto-navigate after the operator has a moment to read the banner.
          setTimeout(() => navigate('/people/students'), 2500);
          return;
        }
        if (fpu.pinMarkedStale) {
          setPinNotice({ kind: 'fee-axis-changed', studentId: id!, changedFields: changedFeeAxes });
          return;
        }
      }

      navigate('/people/students');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError('');

    // Tab-aware required-field check. Inactive-tab inputs are unmounted,
    // so HTML5 `required` won't fire for them. We manually validate each
    // tab's required fields and bounce the user to the offending tab so
    // they see the empty input clearly rather than a silent submit.
    if (!form.name) {
      setFormTab('profile');
      setValidationError('Name is required.');
      return;
    }
    if (!form.phone) {
      setFormTab('profile');
      setValidationError('Phone is required.');
      return;
    }
    if (!form.admissionYear) {
      setFormTab('academic');
      setValidationError('Admission Year is required.');
      return;
    }

    const checklistComplete = [
      form.profileVerified,
      form.documentsVerified,
      form.feePlanConfirmed,
      form.portalAccessShared,
      form.idCardIssued,
    ].every(Boolean);

    if (form.onboardingStatus === 'completed') {
      if (!form.feeResponsibleParentId) {
        setFormTab('profile');
        setValidationError('Fee responsible guardian is required before onboarding can be marked completed.');
        return;
      }
      if (!checklistComplete) {
        setFormTab('profile');
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
              — saving will automatically map the matching fee structure. If no match is
              found you'll be prompted to re-pin manually.
            </div>
          </div>
        </div>
      )}

      {pinNotice && pinNotice.kind === 'rebind-success' && (
        <div role="status" className="mb-4 rounded-lg border border-green-300 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-green-900">Fee structure automatically updated.</p>
              <p className="text-green-800 mt-1">
                The matching fee structure has been re-pinned for Year{' '}
                {pinNotice.yearOfStudy ?? 1} based on the updated{' '}
                <span className="font-semibold">
                  {pinNotice.changedFields.map((f) => FEE_AXIS_LABELS[f] ?? f).join(', ')}
                </span>
                . Returning to students list…
              </p>
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
                No matching fee structure found — manual re-pin needed.
              </p>
              <p className="text-amber-800 mt-1">
                The update saved successfully, but no active fee structure was found for
                the new{' '}
                <span className="font-semibold">
                  {pinNotice.changedFields.map((f) => FEE_AXIS_LABELS[f] ?? f).join(', ')}
                </span>{' '}
                combination. Open the student to pin the correct fee structure manually,
                or ask Finance to create a matching FeeStructureInstance first.
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

      {/* Tabs nav. Mirrors StudentDetailPage so the create / edit and
          view experiences feel like the same surface. The Academic
          Details tab carries an amber dot in edit mode while the
          operator has unsaved fee-axis changes pending — same signal
          the inline current-fee strip uses. */}
      <div className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur border-b border-gray-200 -mx-2 px-2 mb-4">
        <nav className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Student form sections">
          {FORM_TABS.map((t) => {
            const isActive = formTab === t.key;
            const showAmberDot = t.key === 'academic' && willTriggerStalePin;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`form-tabpanel-${t.key}`}
                id={`form-tab-${t.key}`}
                onClick={() => setFormTab(t.key)}
                className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary-500 text-primary-700'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                {t.label}
                {showAmberDot && (
                  <span
                    className="absolute top-2 right-1 inline-block h-2 w-2 rounded-full bg-amber-500"
                    aria-label="Unsaved fee-axis change — needs review"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <form id="student-form" onSubmit={handleSubmit} className="space-y-6">
        {/* ── Profile tab ─────────────────────────────────────────── */}
        {formTab === 'profile' && (
          <div role="tabpanel" id="form-tabpanel-profile" aria-labelledby="form-tab-profile" className="space-y-6">
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
          </div>
        )}

        {/* ── Academic Details tab ────────────────────────────────── */}
        {formTab === 'academic' && (
          <div role="tabpanel" id="form-tabpanel-academic" aria-labelledby="form-tab-academic" className="space-y-6">
        {/* Academic Details */}
        <section className="bg-white rounded-xl border shadow-sm">
          <div className="px-5 py-4 border-b bg-navy/[0.03] rounded-t-xl">
            <h3 className="font-semibold text-navy-dark">Academic Details</h3>
            <p className="text-xs text-gray-500 mt-0.5">Enrollment and academic information</p>
          </div>
          {/* Fee-structure context strips. Two stacked strips appear above
              the input grid:
                1. CURRENT pin (edit mode + active pin exists) — what's
                   on the student today.
                2. PREVIEW match — the FSI that *would* be pinned given
                   the current form selection. Updates live as the
                   operator changes programme / branch / category /
                   quota / etc.
              The two stacked strips let the operator compare "what's
              there" with "what saving will do" before clicking Save. */}
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
                          — saving will switch this
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
                    <ComponentBreakdown
                      components={currentComponents}
                      palette={
                        willTriggerStalePin
                          ? { sub: 'text-amber-700', body: 'text-amber-900', row: 'border-amber-200 divide-amber-200 bg-white/60', pill: 'bg-amber-100 text-amber-800' }
                          : { sub: 'text-slate-500', body: 'text-slate-700', row: 'border-slate-200 divide-slate-200 bg-white', pill: 'bg-slate-200 text-slate-700' }
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PREVIEW strip — live "what saving would map to" indicator.
              Appears whenever a programme is selected. Three states:
                - loading: faint slate placeholder
                - matched + same as current pin: green "matches current"
                - matched + different from current pin (or create mode): blue "will be applied"
                - no match: red "no matching fee structure" with hint
              Skipped when there's no programme yet — the resolver
              would just return null. */}
          {form.programmeId && (
            <div className="px-5 pt-2 pb-1">
              {previewLoading ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-500 italic">
                  Resolving matching fee structure…
                </div>
              ) : previewFsi ? (
                (() => {
                  const matchesCurrent =
                    !!activePinFsi && String(previewFsi._id) === String(activePinFsi._id);
                  const palette = matchesCurrent
                    ? { border: 'border-emerald-300', bg: 'bg-emerald-50', icon: 'text-emerald-600', title: 'text-emerald-900', body: 'text-emerald-800', sub: 'text-emerald-700' }
                    : { border: 'border-blue-300', bg: 'bg-blue-50', icon: 'text-blue-600', title: 'text-blue-900', body: 'text-blue-800', sub: 'text-blue-700' };
                  const previewBranchName =
                    typeof previewFsi.branchId === 'object' && previewFsi.branchId
                      ? previewFsi.branchId.name ?? '<set>'
                      : previewFsi.branchId
                      ? '<set>'
                      : 'any';
                  return (
                    <div className={`rounded-lg border ${palette.border} ${palette.bg} p-3 text-sm`}>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 size={14} className={`mt-0.5 ${palette.icon} flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium ${palette.title}`}>
                            Matching fee structure (Year {previewYearOfStudy})
                            <span className={`ml-2 text-xs font-normal ${palette.sub}`}>
                              {matchesCurrent
                                ? '— same as current pin, no change on save'
                                : isEdit
                                ? '— saving will switch to this'
                                : '— this will be applied on create'}
                            </span>
                          </div>
                          <div className={`text-xs mt-0.5 ${palette.body}`}>
                            <span className="font-semibold">{previewFsi.name ?? previewFsi.code ?? 'Fee Structure'}</span>
                            <span className="mx-2">·</span>
                            <span className="font-bold">
                              {`₹${(previewFsi.totalAmount ?? 0).toLocaleString('en-IN')}`}
                            </span>
                          </div>
                          <div className={`text-xs mt-1 ${palette.sub}`}>
                            Quota:{' '}
                            <span className="font-mono">{previewFsi.quota ?? 'any'}</span>
                            <span className="mx-1.5">·</span>
                            Category:{' '}
                            <span className="font-mono">{previewFsi.category ?? 'any'}</span>
                            <span className="mx-1.5">·</span>
                            Branch:{' '}
                            <span className="font-mono">{previewBranchName}</span>
                          </div>
                          <ComponentBreakdown
                            components={previewComponents}
                            palette={
                              matchesCurrent
                                ? { sub: 'text-emerald-700', body: 'text-emerald-900', row: 'border-emerald-200 divide-emerald-200 bg-white/60', pill: 'bg-emerald-100 text-emerald-800' }
                                : { sub: 'text-blue-700', body: 'text-blue-900', row: 'border-blue-200 divide-blue-200 bg-white/60', pill: 'bg-blue-100 text-blue-800' }
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-red-900">
                        No matching fee structure for this combination
                      </div>
                      <div className="text-xs text-red-800 mt-0.5">
                        {previewData?.reason === 'no-academic-year'
                          ? 'No active academic year is set for this college. Set the current academic year before saving.'
                          : 'Ask Finance to create a FeeStructureInstance for this programme + quota + category + branch combination, otherwise saving will leave the student without a fee pin.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
            <div>
              <label className={lbl}>
                Quota
                <Link to="/finance/fee-management/fee-quotas" target="_blank" className={manageLink}>
                  + Manage <ExternalLink size={10} />
                </Link>
              </label>
              <select value={form.quota} onChange={e => setForm(f => ({ ...f, quota: e.target.value }))} className={inp}>
                <option value="">Select quota</option>
                {(feeQuotasData?.items ?? [])
                  .filter((q: { status?: string }) => q.status !== 'inactive')
                  .map((q: { _id: string; code: string; name: string }) => (
                    <option key={q._id} value={q.code}>{q.code} — {q.name}</option>
                  ))}
              </select>
            </div>
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
          </div>
        )}

        {/* ── Profile tab (continued: Guardians + Onboarding) ─────── */}
        {formTab === 'profile' && (
          <div role="tabpanel" id="form-tabpanel-profile-2" aria-labelledby="form-tab-profile" className="space-y-6">
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
          </div>
        )}

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
