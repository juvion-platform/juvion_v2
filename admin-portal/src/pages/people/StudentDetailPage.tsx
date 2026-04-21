import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Loader2, AlertCircle } from 'lucide-react';
import { getStudent } from '../../services/people';
import Badge from '../../components/ui/Badge';
import {
  DetailSection, DetailField, DetailBool, formatDate, extractPerson,
} from '../../components/ui/DetailView';
import FeePinsPanel from '../../components/finance/FeePinsPanel';

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

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: s, isLoading, error } = useQuery({
    queryKey: ['student', id],
    queryFn: () => getStudent(id!),
    enabled: !!id,
  });

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
          <Link
            to="/people/students"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Students
          </Link>
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

      {/* Academic */}
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
  );
}
