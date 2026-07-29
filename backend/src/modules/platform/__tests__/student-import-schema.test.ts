import { describe, it, expect } from 'vitest';
import { getImportSchema, listImportEntityTypes } from '../bulk-import-registry';
import type { ImportCommitContext } from '../import-schemas/types';

/** Field validators are synchronous and touch no DB, so any well-formed context does. */
const CTX: ImportCommitContext = { collegeId: 'c', performedBy: 'p', jobId: 'j' };

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

  // The whole-file duplicate check is opt-in precisely so the other four
  // entity types keep the behaviour they had before this branch. Student is
  // the only schema that upserts, so it is the only one where two rows
  // claiming one identity destroys data rather than merely duplicating it.
  it('is the only entity type that opts into whole-file duplicate detection', () => {
    expect(def!.naturalKeys).toBeTypeOf('function');
    const others = listImportEntityTypes().filter((d) => d.entityType !== 'student');
    expect(others.map((d) => d.entityType).sort())
      .toEqual(['applicant', 'faculty', 'programme', 'staff']);
    for (const other of others) {
      expect(other.naturalKeys, `${other.entityType} must not opt in`).toBeUndefined();
    }
  });

  it('rejects a blank required field', () => {
    const nameField = def!.fields.find((f) => f.fieldKey === 'name')!;
    const res = nameField.validate('', {}, CTX);
    expect(res.ok).toBe(false);
  });

  it('accepts a valid gender and rejects an invalid one', () => {
    const g = def!.fields.find((f) => f.fieldKey === 'gender')!;
    expect(g.validate('male', {}, CTX).ok).toBe(true);
    expect(g.validate('helicopter', {}, CTX).ok).toBe(false);
  });

  it('bounds studyYearAtAdmission to 1-8', () => {
    const y = def!.fields.find((f) => f.fieldKey === 'studyYearAtAdmission')!;
    expect(y.validate('1', {}, CTX).ok).toBe(true);
    expect(y.validate('9', {}, CTX).ok).toBe(false);
  });

  // Regression test: Aadhaar is printed on the physical card grouped as
  // "XXXX XXXX XXXX", so operators paste it that way. The value stored must
  // be the normalized 12-digit form (not the spaced original) so it stays
  // consistent with the exact-equality Aadhaar lookup in
  // matchExistingStudent (Person.find({ collegeId, aadhaar })).
  it('accepts a grouped-format Aadhaar and normalizes it to 12 digits', () => {
    const a = def!.fields.find((f) => f.fieldKey === 'aadhaar')!;
    const res = a.validate('2345 6789 0101', {}, CTX);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBe('234567890101');
  });

  /**
   * Phone is a natural key: matchExistingStudent falls through to
   * Person.find({ collegeId, phone }) + admissionYear, and linkOrCreateParent
   * resolves guardians by phone. Operators paste from WhatsApp, contact cards
   * and spreadsheets, and the manual student form accepts those formats
   * verbatim (z.string().min(10) behind a plain text input) — so the importer
   * refusing them was stricter than the platform's own UI, and storing a
   * spaced value would break the key comparison. Same lesson as Aadhaar.
   */
  describe.each([
    ['plain 10-digit', '9876543210'],
    ['spaced', '98765 43210'],
    ['hyphenated', '98765-43210'],
    ['+91 prefixed', '+91 9876543210'],
    ['91 prefixed, no plus', '919876543210'],
    ['leading trunk 0', '09876543210'],
    ['parenthesised STD-style', '(98765) 43210'],
    ['dotted', '98765.43210'],
  ])('phone accepts %s and stores it compact', (_label, raw) => {
    for (const key of ['phone', 'primaryParentPhone', 'feeResponsibleParentPhone']) {
      it(`on ${key}`, () => {
        const f = def!.fields.find((x) => x.fieldKey === key)!;
        const res = f.validate(raw, {}, CTX);
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.value).toBe('9876543210');
      });
    }
  });

  it('still rejects a phone that is not 10 digits once separators are stripped', () => {
    const p = def!.fields.find((f) => f.fieldKey === 'phone')!;
    for (const bad of ['12345', '98765 4321', 'abcdefghij', '9876543210123']) {
      const res = p.validate(bad, {}, CTX);
      expect(res.ok, `expected ${bad} to be rejected`).toBe(false);
    }
  });

  it('leaves an optional guardian phone empty rather than failing the row', () => {
    const g = def!.fields.find((f) => f.fieldKey === 'primaryParentPhone')!;
    const res = g.validate('   ', {}, CTX);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBe('');
  });
});
