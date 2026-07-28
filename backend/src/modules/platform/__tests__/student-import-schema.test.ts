import { describe, it, expect } from 'vitest';
import { getImportSchema } from '../bulk-import-registry';

const REQUIRED = ['name', 'phone', 'programmeCode', 'admissionYear'];
const EXPECTED_KEYS = [
  'name', 'phone', 'email', 'gender', 'dob', 'aadhaar',
  'addressLine1', 'addressLine2', 'city', 'state', 'pincode',
  'programmeCode', 'branchCode', 'batchCode', 'regulationCode',
  'admissionYear', 'studyYearAtAdmission', 'rollNumber', 'quota',
  'category', 'status',
  'primaryParentPhone', 'primaryParentName', 'feeResponsibleParentPhone',
];

const FORBIDDEN = [
  'feeStatus', 'hasFinancialHold', 'feePins', 'isSealed',
  'graduationDate', 'exitDate', 'alumniId', 'finalCgpa',
  // Onboarding completion is a lifecycle outcome the platform owns:
  // `assertStudentOnboardingRules` (people/service.ts) refuses
  // `completed` unless a fee-responsible guardian exists and all five
  // checklist items are true, and stamps `onboardingCompletedAt`. A
  // spreadsheet column bypassed all of that, so the column is gone and
  // the model default (`not_started`) applies to every imported student.
  'onboardingStatus',
];

describe('student import schema', () => {
  const def = getImportSchema('student');

  it('is registered', () => {
    expect(def).not.toBeNull();
  });

  it('exposes exactly the 24 operator-authored fields', () => {
    expect(def!.fields).toHaveLength(24);
    expect(def!.fields.map((f) => f.fieldKey).sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it('marks exactly the four mandatory fields required', () => {
    const required = def!.fields.filter((f) => f.required).map((f) => f.fieldKey).sort();
    expect(required).toEqual([...REQUIRED].sort());
  });

  it('never exposes a system-managed field', () => {
    const keys = def!.fields.map((f) => f.fieldKey);
    for (const f of FORBIDDEN) expect(keys).not.toContain(f);
  });

  it('has a sample value for every field so the template row is complete', () => {
    for (const f of def!.fields) {
      expect(Object.keys(def!.sampleRow)).toContain(f.fieldKey);
    }
  });

  it('rejects a blank required field', () => {
    const nameField = def!.fields.find((f) => f.fieldKey === 'name')!;
    const res = nameField.validate('', {}, { collegeId: 'c', performedBy: 'p' });
    expect(res.ok).toBe(false);
  });

  it('accepts a valid gender and rejects an invalid one', () => {
    const g = def!.fields.find((f) => f.fieldKey === 'gender')!;
    expect(g.validate('male', {}, { collegeId: 'c', performedBy: 'p' }).ok).toBe(true);
    expect(g.validate('helicopter', {}, { collegeId: 'c', performedBy: 'p' }).ok).toBe(false);
  });

  it('bounds studyYearAtAdmission to 1-8', () => {
    const y = def!.fields.find((f) => f.fieldKey === 'studyYearAtAdmission')!;
    expect(y.validate('1', {}, { collegeId: 'c', performedBy: 'p' }).ok).toBe(true);
    expect(y.validate('9', {}, { collegeId: 'c', performedBy: 'p' }).ok).toBe(false);
  });

  // Regression test: Aadhaar is printed on the physical card grouped as
  // "XXXX XXXX XXXX", so operators paste it that way. The value stored must
  // be the normalized 12-digit form (not the spaced original) so it stays
  // consistent with the exact-equality Aadhaar lookup in
  // matchExistingStudent (Person.find({ collegeId, aadhaar })).
  it('accepts a grouped-format Aadhaar and normalizes it to 12 digits', () => {
    const a = def!.fields.find((f) => f.fieldKey === 'aadhaar')!;
    const res = a.validate('2345 6789 0101', {}, { collegeId: 'c', performedBy: 'p' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBe('234567890101');
  });
});
