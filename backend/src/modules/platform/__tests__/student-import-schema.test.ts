import { describe, it, expect } from 'vitest';
import { getImportSchema } from '../bulk-import-registry';

const REQUIRED = ['name', 'phone', 'programmeCode', 'admissionYear'];
const EXPECTED_KEYS = [
  'name', 'phone', 'email', 'gender', 'dob', 'aadhaar',
  'addressLine1', 'addressLine2', 'city', 'state', 'pincode',
  'programmeCode', 'branchCode', 'batchCode', 'regulationCode',
  'admissionYear', 'studyYearAtAdmission', 'rollNumber', 'quota',
  'category', 'status', 'onboardingStatus',
  'primaryParentPhone', 'primaryParentName', 'feeResponsibleParentPhone',
];

const FORBIDDEN = [
  'feeStatus', 'hasFinancialHold', 'feePins', 'isSealed',
  'graduationDate', 'exitDate', 'alumniId', 'finalCgpa',
];

describe('student import schema', () => {
  const def = getImportSchema('student');

  it('is registered', () => {
    expect(def).not.toBeNull();
  });

  it('exposes exactly the 25 operator-authored fields', () => {
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
});
