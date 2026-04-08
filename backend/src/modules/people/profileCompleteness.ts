export interface ProfileCompleteness {
  percent: number;
  status: 'incomplete' | 'progressing' | 'complete';
  missing: string[];
}

export interface OnboardingCompleteness {
  percent: number;
  status: 'not_started' | 'in_progress' | 'completed';
  missing: string[];
}

interface Check {
  label: string;
  value: unknown;
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return true;
  return true;
}

function finalize(checks: Check[]): ProfileCompleteness {
  const total = checks.length || 1;
  const passed = checks.filter(check => hasValue(check.value)).length;
  const percent = Math.round((passed / total) * 100);
  const status: ProfileCompleteness['status'] = percent >= 80 ? 'complete' : percent >= 50 ? 'progressing' : 'incomplete';
  return {
    percent,
    status,
    missing: checks.filter(check => !hasValue(check.value)).map(check => check.label),
  };
}

function resolvePerson(record: any) {
  return record?.person || record?.personId || record;
}

function baseChecks(record: any): Check[] {
  const person = resolvePerson(record) || {};
  return [
    { label: 'Email', value: person.email },
    { label: 'Date of birth', value: person.dob },
    { label: 'Gender', value: person.gender },
    { label: 'Aadhaar', value: person.aadhaar },
    { label: 'Alternate phone', value: person.alternatePhone },
    { label: 'Preferred language', value: person.preferredLanguage },
    { label: 'Address line 1', value: person.address?.line1 },
    { label: 'City', value: person.address?.city },
    { label: 'State', value: person.address?.state },
    { label: 'Pincode', value: person.address?.pincode },
    { label: 'Emergency contact name', value: person.emergencyContact?.name },
    { label: 'Emergency contact phone', value: person.emergencyContact?.phone },
  ];
}

export function getStudentProfileCompleteness(record: any): ProfileCompleteness {
  return finalize([
    ...baseChecks(record),
    { label: 'Programme', value: record?.programme?._id || record?.programmeId },
    { label: 'Branch', value: record?.branch?._id || record?.branchId },
    { label: 'Batch', value: record?.batch?._id || record?.batchId },
    { label: 'Primary parent', value: record?.primaryParentId?._id || record?.primaryParentId },
    { label: 'Fee responsible guardian', value: record?.feeResponsibleParentId?._id || record?.feeResponsibleParentId },
    { label: 'Roll number', value: record?.rollNumber },
    { label: 'Regulation', value: record?.regulation?._id || record?.regulationId },
    { label: 'Quota', value: record?.quota },
    { label: 'Category', value: record?.category },
  ]);
}

export function getStudentOnboardingCompleteness(record: any): OnboardingCompleteness {
  const checklist = record?.onboardingChecklist || {};
  const checks: Check[] = [
    { label: 'Profile verified', value: checklist.profileVerified },
    { label: 'Documents verified', value: checklist.documentsVerified },
    { label: 'Fee plan confirmed', value: checklist.feePlanConfirmed },
    { label: 'Portal access shared', value: checklist.portalAccessShared },
    { label: 'ID card issued', value: checklist.idCardIssued },
  ];
  const total = checks.length || 1;
  const passed = checks.filter(check => hasValue(check.value)).length;
  const percent = Math.round((passed / total) * 100);
  const status: OnboardingCompleteness['status'] =
    percent === 100 || record?.onboardingStatus === 'completed'
      ? 'completed'
      : percent > 0 || record?.onboardingStatus === 'in_progress'
        ? 'in_progress'
        : 'not_started';
  return {
    percent,
    status,
    missing: checks.filter(check => !hasValue(check.value)).map(check => check.label),
  };
}

export function getFacultyProfileCompleteness(record: any): ProfileCompleteness {
  return finalize([
    ...baseChecks(record),
    { label: 'Department', value: record?.department?._id || record?.departmentId },
    { label: 'Qualification', value: record?.qualification },
    { label: 'Specialization', value: record?.specialization },
  ]);
}

export function getStaffProfileCompleteness(record: any): ProfileCompleteness {
  return finalize([
    ...baseChecks(record),
    { label: 'Department', value: record?.department?._id || record?.departmentId },
  ]);
}

export function getParentProfileCompleteness(record: any): ProfileCompleteness {
  return finalize([
    ...baseChecks(record),
    { label: 'Linked students', value: record?.linkedStudents },
    { label: 'Occupation', value: record?.occupation },
    { label: 'Employer', value: record?.employer },
    { label: 'Annual income band', value: record?.annualIncomeBand },
    { label: 'Communication preference', value: record?.communicationPreference },
  ]);
}

export function getOrganizationProfileCompleteness(record: any): ProfileCompleteness {
  return finalize([
    { label: 'Address', value: record?.address },
    { label: 'Primary contact', value: record?.contact },
    { label: 'Contact person name', value: record?.contactPersonName },
    { label: 'Contact person email', value: record?.contactPersonEmail },
    { label: 'Contact person phone', value: record?.contactPersonPhone },
    { label: 'Partnership type', value: record?.partnershipType },
  ]);
}
