import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Loader2, AlertCircle, AlertTriangle } from 'lucide-react';
import { getStudent } from '../../services/people';
import { getStudentPins, type IFeePin, type PopulatedFeeStructureInstance } from '../../services/fee-configuration';
import Badge from '../../components/ui/Badge';
import {
  DetailSection, DetailField, DetailBool, formatDate, extractPerson,
} from '../../components/ui/DetailView';
import FeePinsPanel from '../../components/finance/FeePinsPanel';
import StudentFeeStructurePanel from '../../components/finance/StudentFeeStructurePanel';
import PersonPhotoBlock from '../../components/people/PersonPhotoBlock';
import StudentPortfolioPanel from '../../components/student-dev/StudentPortfolioPanel';

/** Returns the most recent non-archived pin, or undefined. */
function pickActivePin(pins: IFeePin[]): IFeePin | undefined {
  const live = pins.filter((p) => !p.archivedAt);
  if (live.length === 0) return undefined;
  return [...live].sort((a, b) => (b.yearOfStudy ?? 0) - (a.yearOfStudy ?? 0))[0];
}

/** Pull the populated FSI from the polymorphic pin field, if present. */
function pinFsi(pin: IFeePin | undefined): PopulatedFeeStructureInstance | undefined {
  if (!pin) return undefined;
  const f = pin.feeStructureInstanceId;
  return typeof f === 'object' && f !== null ? f : undefined;
}

/** Resolve an `id-or-populated-ref` to a plain id string for comparison. */
function idOf(ref: unknown): string | null {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object' && '_id' in (ref as Record<string, unknown>)) {
    return String((ref as { _id: unknown })._id);
  }
  return null;
}

/** Resolve an `id-or-populated-ref` to a display name for the drift list. */
function nameOf(ref: unknown, fallback?: string): string {
  if (!ref) return fallback ?? '—';
  if (typeof ref === 'string') return fallback ?? ref;
  if (typeof ref === 'object' && 'name' in (ref as Record<string, unknown>)) {
    return ((ref as { name?: string }).name) ?? fallback ?? '—';
  }
  return fallback ?? '—';
}

/**
 * Read-only view for a single Student. Clicking Edit navigates to the
 * existing `/people/students/:id/edit` form page — no form logic here.
 */

const STATUS_COLOR: Record<string, string> = {
  prospective: 'default', active: 'success', year_back: 'warning',
  detained: 'danger', graduated: 'teal', exited: 'danger', alumni: 'purple',
};
const ONBOARDING_COLOR: Record<string, string> = {
  not_started: 'default', in_progress: 'warning', completed: 'success',
};

/**
 * Tabbed layout. The page used to be one long scroll mixing identity,
 * academic, and finance. Splitting along those axes lets the operator
 * jump straight to what they need.
 *
 * `dotColor` drives the attention indicator next to the tab name —
 * 'red' for hard drift (mismatches), 'amber' for a soft "look here"
 * (no active pin). The dot is only rendered when the matching condition
 * is true at runtime.
 */
type DetailTabKey = 'profile' | 'academic' | 'fees' | 'portfolio';
const TAB_KEYS: DetailTabKey[] = ['profile', 'academic', 'fees', 'portfolio'];
interface DetailTab {
  key: DetailTabKey;
  label: string;
}
const DETAIL_TABS: ReadonlyArray<DetailTab> = [
  { key: 'profile', label: 'Profile' },
  { key: 'academic', label: 'Academic Details' },
  { key: 'fees', label: 'Fee Structure' },
  { key: 'portfolio', label: 'Portfolio' },
];

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Tab state lives in the URL (?tab=finance) so a specific tab can be
  // deep-linked, shared and survives a refresh. Defaults to Profile.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as DetailTabKey | null;
  const tab: DetailTabKey = tabParam && TAB_KEYS.includes(tabParam) ? tabParam : 'profile';
  const setTab = (next: DetailTabKey) => {
    // replace, not push — flipping tabs shouldn't stack history entries the
    // user then has to click back through.
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (next === 'profile') p.delete('tab');
      else p.set('tab', next);
      return p;
    }, { replace: true });
  };
  const { data: s, isLoading, error } = useQuery({
    queryKey: ['student', id],
    queryFn: () => getStudent(id!),
    enabled: !!id,
  });

  // Same query key as <FeePinsPanel /> + <StudentFeeStructurePanel />.
  // React Query dedupes by key, so this fires the network request once
  // for the whole page even though three components subscribe.
  const pinsQuery = useQuery({
    queryKey: ['student-pins', id],
    queryFn: () => getStudentPins(id!),
    enabled: !!id,
  });

  // ── Hooks block ──
  // EVERY hook must run unconditionally on every render — the early
  // returns below skip the rest of the body, so any hook placed AFTER
  // them would change call order between loading/loaded paints and
  // crash with "Rendered more hooks than during the previous render".
  // We tolerate `s` being undefined inside these memos and short-circuit.
  const mismatches = useMemo(() => {
    if (!s) return [];
    const active = pickActivePin(pinsQuery.data?.pins ?? []);
    const fsi = pinFsi(active);
    if (!fsi) return [];
    const out: { field: string; student: string; pinned: string }[] = [];

    const studentProgId = idOf(s.programmeId) ?? idOf(s.programme);
    const pinProgId = idOf(fsi.programmeId);
    if (studentProgId && pinProgId && studentProgId !== pinProgId) {
      out.push({
        field: 'Programme',
        student: nameOf(s.programmeId ?? s.programme, s.programmeId?.name ?? s.programme?.name),
        pinned: nameOf(fsi.programmeId),
      });
    }

    const studentBranchId = idOf(s.branchId) ?? idOf(s.branch);
    const pinBranchId = idOf(fsi.branchId);
    if (studentBranchId && pinBranchId && studentBranchId !== pinBranchId) {
      out.push({
        field: 'Branch',
        student: nameOf(s.branchId ?? s.branch, s.branchId?.name ?? s.branch?.name),
        pinned: nameOf(fsi.branchId),
      });
    }

    const studentCategory = (s.category as string | null | undefined) ?? null;
    const pinCategory = fsi.category ?? null;
    if (studentCategory && pinCategory && studentCategory !== pinCategory) {
      out.push({ field: 'Category', student: studentCategory, pinned: pinCategory });
    }

    const studentQuota = (s.quota as string | null | undefined) ?? null;
    const pinQuota = fsi.quota ?? null;
    if (studentQuota && pinQuota && studentQuota !== pinQuota) {
      out.push({ field: 'Quota', student: studentQuota, pinned: pinQuota });
    }

    return out;
  }, [pinsQuery.data, s]);
  const activePinExists = useMemo(
    () => pickActivePin(pinsQuery.data?.pins ?? []) !== undefined,
    [pinsQuery.data],
  );

  // ── Early returns (after all hooks have run) ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (error || !s) {
    return (
      <div className="py-20 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <div className="text-gray-700 font-medium">Couldn't load student</div>
        <Link to="/people/students" className="inline-flex items-center gap-1 text-sm text-primary-600 mt-4">
          <ArrowLeft className="w-4 h-4" /> Back to Students
        </Link>
      </div>
    );
  }

  const person = extractPerson(s);
  const address = person.address || {};
  const emergency = person.emergencyContact || {};
  const checklist = s.onboardingChecklist || {};

  // Populated references may arrive as objects with `.name` or as plain IDs.
  const programmeName = s.programmeId?.name ?? s.programme?.name;
  const branchName = s.branchId?.name ?? s.branch?.name;
  const regulationName = s.regulationId?.name ?? s.regulation?.name;
  const batchName = s.batchId?.name ?? s.batch?.name;
  const primaryParentName = s.primaryParentId?.name ?? s.primaryParentPerson?.name;
  const feeParentName = s.feeResponsibleParentId?.name ?? s.feeResponsibleParentPerson?.name;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">{person.name || 'Student'}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            {s.rollNumber && <span className="font-mono">{s.rollNumber}</span>}
            {s.rollNumber && s.status && <span>·</span>}
            {s.status && (
              <Badge variant={STATUS_COLOR[s.status] || 'default'}>
                {s.status.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/people/students/${id}/edit`)}
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"
        >
          <Pencil className="w-4 h-4" /> Edit
        </button>
      </div>

      {/* Profile photo — sits above the tabs so the student is
          identifiable immediately regardless of which tab is active. */}
      {id && (
        <PersonPhotoBlock
          entityType="students"
          entityId={id}
          personName={person.name}
        />
      )}

      {/* Tabs nav. Mirrors the FinancialHoldsPage style for consistency
          with the rest of the admin portal. The attention dot per tab:
            - Academic: red — fee-axis drift detected (mismatches)
            - Fees:     amber — no active fee pin exists
          Both are silent on the loading path to avoid flashing. */}
      <div className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur border-b border-gray-200 -mx-2 px-2">
        <nav className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Student detail sections">
          {DETAIL_TABS.map((t) => {
            const isActive = tab === t.key;
            const showRedDot = t.key === 'academic' && mismatches.length > 0;
            const showAmberDot =
              t.key === 'fees' && !pinsQuery.isLoading && !activePinExists;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${t.key}`}
                id={`tab-${t.key}`}
                onClick={() => setTab(t.key)}
                className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary-500 text-primary-700'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                {t.label}
                {showRedDot && (
                  <span
                    className="absolute top-2 right-1 inline-block h-2 w-2 rounded-full bg-red-500"
                    aria-label="Drift detected — needs attention"
                  />
                )}
                {showAmberDot && (
                  <span
                    className="absolute top-2 right-1 inline-block h-2 w-2 rounded-full bg-amber-500"
                    aria-label="No fee pin — needs attention"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Profile tab ──────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div role="tabpanel" id="tabpanel-profile" aria-labelledby="tab-profile" className="space-y-4">
          {/* Personal Information */}
          <DetailSection title="Personal Information">
            <DetailField label="Full Name" value={person.name} />
            <DetailField label="Gender" value={person.gender} />
            <DetailField label="Date of Birth" value={formatDate(person.dob)} />
            <DetailField label="Phone" value={person.phone} />
            <DetailField label="Alternate Phone" value={person.alternatePhone} />
            <DetailField label="Email" value={person.email} />
            <DetailField label="Aadhaar" value={person.aadhaar} mono />
            <DetailField label="Preferred Language" value={person.preferredLanguage} />
            <DetailBool label="Biometric Enrolled" value={person.biometricEnrolled} />
          </DetailSection>

          {/* Guardians */}
          {(primaryParentName || feeParentName) && (
            <DetailSection title="Guardians" columns={2}>
              <DetailField label="Primary Parent" value={primaryParentName} />
              <DetailField label="Fee-Responsible Parent" value={feeParentName} />
            </DetailSection>
          )}

          {/* Onboarding */}
          <DetailSection title="Onboarding" columns={3}>
            <DetailField label="Onboarding Status">
              <Badge variant={ONBOARDING_COLOR[s.onboardingStatus] || 'default'}>
                {s.onboardingStatus?.replace(/_/g, ' ') || '—'}
              </Badge>
            </DetailField>
            <DetailBool label="Profile Verified" value={checklist.profileVerified} />
            <DetailBool label="Documents Verified" value={checklist.documentsVerified} />
            <DetailBool label="Fee Plan Confirmed" value={checklist.feePlanConfirmed} />
            <DetailBool label="Portal Access Shared" value={checklist.portalAccessShared} />
            <DetailBool label="ID Card Issued" value={checklist.idCardIssued} />
          </DetailSection>

          {/* Address */}
          <DetailSection title="Address" columns={3}>
            <DetailField label="Address Line 1" value={address.line1} wide />
            <DetailField label="Address Line 2" value={address.line2} wide />
            <DetailField label="City" value={address.city} />
            <DetailField label="State" value={address.state} />
            <DetailField label="Pincode" value={address.pincode} />
          </DetailSection>

          {/* Emergency Contact */}
          <DetailSection title="Emergency Contact" columns={3}>
            <DetailField label="Name" value={emergency.name} />
            <DetailField label="Phone" value={emergency.phone} />
            <DetailField label="Relationship" value={emergency.relationship} />
          </DetailSection>
        </div>
      )}

      {/* ── Academic Details tab ─────────────────────────────────── */}
      {tab === 'academic' && (
        <div role="tabpanel" id="tabpanel-academic" aria-labelledby="tab-academic" className="space-y-4">
          <DetailSection title="Academic Information">
            <DetailField label="Roll Number" value={s.rollNumber} mono />
            <DetailField label="Admission Year" value={s.admissionYear} />
            <DetailField label="Quota" value={s.quota} />
            <DetailField label="Category" value={s.category} />
            <DetailField label="Regulation" value={regulationName} />
            <DetailField label="Programme" value={programmeName} />
            <DetailField label="Branch" value={branchName} />
            <DetailField label="Batch" value={batchName} />
            <DetailField label="Status">
              <Badge variant={STATUS_COLOR[s.status] || 'default'}>
                {s.status?.replace(/_/g, ' ') || '—'}
              </Badge>
            </DetailField>
          </DetailSection>

          {/* Pinned-fee-structure drift indicator. Renders ONLY when the
              student's fee-axis attributes (programme / branch / category /
              quota) disagree with the active pin's FeeStructureInstance — a
              typical symptom of editing a student without re-pinning. The
              callout names every divergent field with both values. */}
          {mismatches.length > 0 && (
            <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-amber-900">
                    Academic details don't match the pinned fee structure
                  </p>
                  <p className="text-amber-800 mt-1">
                    These fields differ between the student record and the pinned
                    FeeStructureInstance. Open the Fee Structure tab to review the pin
                    and apply the matching fee structure.
                  </p>
                  <ul className="mt-2 space-y-0.5 text-amber-900">
                    {mismatches.map((m) => (
                      <li key={m.field} className="text-xs">
                        <span className="font-semibold">{m.field}:</span>{' '}
                        <span className="font-mono">{m.student}</span>
                        <span className="mx-1 text-amber-600">→ pinned as</span>
                        <span className="font-mono">{m.pinned}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setTab('fees')}
                    className="mt-3 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-md hover:bg-amber-700"
                  >
                    Go to Fee Structure
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* No-pin notice — surfaced only when pins finished loading and no
              active pin exists. Quiet on the loading path so we don't flash. */}
          {!pinsQuery.isLoading && !activePinExists && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 flex items-center justify-between gap-3">
              <span>No fee structure pinned for this student.</span>
              <button
                type="button"
                onClick={() => setTab('fees')}
                className="px-3 py-1 bg-slate-700 text-white text-xs font-medium rounded-md hover:bg-slate-800"
              >
                Pin in Fee Structure tab
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Fee Structure tab ────────────────────────────────────── */}
      {tab === 'fees' && (
        <div role="tabpanel" id="tabpanel-fees" aria-labelledby="tab-fees" className="space-y-4">
          {/* Fee Structure summary — billed/paid/waived/balance + per-component
              breakdown + active holds. Sits above FeePinsPanel so the financial
              state appears before the lifecycle/admin controls. */}
          {id && <StudentFeeStructurePanel studentId={id} />}

          {/* Fee Pins (Task 13) */}
          {id && (
            <FeePinsPanel
              studentId={id}
              programmeId={s.programmeId?._id ?? s.programmeId}
              branchId={s.branchId?._id ?? s.branchId}
              academicYearId={
                s.batchId?.academicYearId?._id ??
                s.batchId?.academicYearId ??
                s.batch?.academicYearId
              }
              quota={s.quota}
              category={s.category}
              currentYearOfStudy={s.currentYearOfStudy ?? s.yearOfStudy}
            />
          )}
        </div>
      )}

      {/* ── Portfolio tab ─────────────────────────────────────────
          The Student Development portfolio API is student-scoped, so it
          belongs here rather than on a college-wide admin list. */}
      {tab === 'portfolio' && (
        <div role="tabpanel" id="tabpanel-portfolio" aria-labelledby="tab-portfolio">
          {id && <StudentPortfolioPanel studentId={id} />}
        </div>
      )}
    </div>
  );
}
