import { commitStudentRow, parentExistsByPhone } from '../../people/student-import-service';
import { resolveStudentRefs, validateCatalogCodes } from '../../people/student-import-refs';
import { matchExistingStudent, feeAxisConflicts } from '../../people/student-import-match';
import type { ImportSchemaDefinition } from './types';
import {
  validString, validNumber, validEnum, validDate, validPhone, validAadhaar, validEmail,
} from './validators';

/**
 * Student bulk-import schema — 24 operator-authored fields.
 *
 * Deliberately excludes everything the payment and lifecycle pipelines own
 * (feeStatus, hasFinancialHold, feePins, isSealed, graduationDate, exitDate,
 * alumniId, finalCgpa). Letting a spreadsheet write those recreates the
 * corrupted-derived-field bug class fixed in the Jul-2026 audit pass.
 *
 * `onboardingStatus` belongs to that same excluded set even though it is
 * operator-facing elsewhere. `assertStudentOnboardingRules`
 * (people/service.ts) refuses `completed` unless a fee-responsible guardian
 * is set and all five checklist items are true, and the service stamps
 * `onboardingCompletedAt` alongside. An import column wrote the raw value
 * and called none of that, producing a student marked complete with no
 * guardian, an empty checklist and no completion timestamp. Onboarding is a
 * lifecycle outcome the platform owns; imported students start at the model
 * default (`not_started`) and progress through the onboarding workflow.
 *
 * `programmeCode` is required even though `programmeId` is optional on the
 * model: a student with no programme cannot be fee-pinned or placed, so
 * importing one creates downstream work rather than saving it.
 */
export const studentImportSchema: ImportSchemaDefinition = {
  entityType: 'student',
  label: 'Students',
  description:
    'Bulk-create or update students. Identity, academic placement and guardians. '
    + 'Mandatory columns are marked with * in the template. Re-uploading a corrected '
    + 'file is safe — rows match on roll number, then Aadhaar, then phone + admission year.',
  fields: [
    // ── Identity → Person ──
    { fieldKey: 'name', label: 'Full Name *', type: 'string', required: true, validate: validString({ required: true, min: 1, max: 200 }) },
    { fieldKey: 'phone', label: 'Phone (10 digits) *', type: 'string', required: true, validate: validPhone({ required: true }) },
    { fieldKey: 'email', label: 'Email', type: 'string', required: false, validate: validEmail({ required: false }) },
    { fieldKey: 'gender', label: 'Gender', type: 'enum', required: false, meta: { values: ['male', 'female', 'other'] }, validate: validEnum({ required: false, values: ['male', 'female', 'other'] }) },
    { fieldKey: 'dob', label: 'Date of Birth (YYYY-MM-DD)', type: 'date', required: false, validate: validDate({ required: false }) },
    { fieldKey: 'aadhaar', label: 'Aadhaar (12 digits)', type: 'string', required: false, validate: validAadhaar({ required: false }) },
    { fieldKey: 'addressLine1', label: 'Address Line 1', type: 'string', required: false, validate: validString({ required: false, max: 200 }) },
    { fieldKey: 'addressLine2', label: 'Address Line 2', type: 'string', required: false, validate: validString({ required: false, max: 200 }) },
    { fieldKey: 'city', label: 'City', type: 'string', required: false, validate: validString({ required: false, max: 100 }) },
    { fieldKey: 'state', label: 'State', type: 'string', required: false, validate: validString({ required: false, max: 100 }) },
    { fieldKey: 'pincode', label: 'Pincode', type: 'string', required: false, validate: validString({ required: false, max: 10 }) },

    // ── Placement → Student ──
    { fieldKey: 'programmeCode', label: 'Programme Code *', type: 'string', required: true, validate: validString({ required: true, max: 50 }) },
    { fieldKey: 'branchCode', label: 'Branch Code', type: 'string', required: false, validate: validString({ required: false, max: 50 }) },
    { fieldKey: 'batchCode', label: 'Batch Code', type: 'string', required: false, validate: validString({ required: false, max: 50 }) },
    { fieldKey: 'regulationCode', label: 'Regulation Code', type: 'string', required: false, validate: validString({ required: false, max: 50 }) },
    { fieldKey: 'admissionYear', label: 'Admission Year *', type: 'number', required: true, validate: validNumber({ required: true, min: 2000, max: 2100 }) },
    { fieldKey: 'studyYearAtAdmission', label: 'Year of Study at Admission (1-8)', type: 'number', required: false, validate: validNumber({ required: false, min: 1, max: 8 }) },
    { fieldKey: 'rollNumber', label: 'Roll Number', type: 'string', required: false, validate: validString({ required: false, max: 50 }) },
    { fieldKey: 'quota', label: 'Quota Code', type: 'string', required: false, validate: validString({ required: false, max: 50 }) },
    { fieldKey: 'category', label: 'Category Code', type: 'string', required: false, validate: validString({ required: false, max: 50 }) },
    { fieldKey: 'status', label: 'Status', type: 'enum', required: false, meta: { values: ['prospective', 'active'] }, validate: validEnum({ required: false, values: ['prospective', 'active'] }) },

    // ── Guardians ──
    { fieldKey: 'primaryParentPhone', label: 'Primary Guardian Phone', type: 'string', required: false, validate: validPhone({ required: false }) },
    { fieldKey: 'primaryParentName', label: 'Primary Guardian Name', type: 'string', required: false, validate: validString({ required: false, max: 200 }) },
    { fieldKey: 'feeResponsibleParentPhone', label: 'Fee-Responsible Guardian Phone', type: 'string', required: false, validate: validPhone({ required: false }) },
  ],
  sampleRow: {
    name: 'Aarav Sharma', phone: '9876543210', email: 'aarav.sharma@example.edu',
    gender: 'male', dob: '2005-03-15', aadhaar: '234567890101',
    addressLine1: '12 MG Road', addressLine2: '', city: 'Hyderabad', state: 'Telangana', pincode: '500001',
    programmeCode: 'BTCSE', branchCode: 'CSE', batchCode: 'B2025', regulationCode: 'R20',
    admissionYear: '2025', studyYearAtAdmission: '1', rollNumber: '25B01A0501',
    quota: 'convener', category: 'OC', status: 'active',
    primaryParentPhone: '9811111111', primaryParentName: 'Ramesh Sharma',
    feeResponsibleParentPhone: '9811111111',
  },
  /**
   * Runs at preview. Field validators are synchronous, so every DB-backed
   * check lives here: resolve the codes, validate the catalogs, and decide
   * whether committing this row would create, update, or is blocked.
   * Without this the operator would confirm an import before learning that
   * half the programme codes are typos.
   */
  async validateRow(typedRow, _rawRow, ctx) {
    const catalog = await validateCatalogCodes(ctx.collegeId, typedRow);
    if (!catalog.ok) return { ok: false, error: catalog.error };

    const refs = await resolveStudentRefs(ctx.collegeId, typedRow);
    if (!refs.ok) return { ok: false, error: refs.error };

    // Echo the resolution back so the operator can confirm "BTCSE" is the
    // programme they meant, rather than only that some programme matched.
    const resolved: Record<string, string> = { Programme: refs.value.programmeName };
    if (refs.value.branchName) resolved.Branch = refs.value.branchName;

    const match = await matchExistingStudent(ctx.collegeId, typedRow);
    if (match.action === 'blocked') {
      return { ok: true, action: 'blocked', notes: [match.reason ?? 'blocked'], resolved };
    }

    // Owner ruling A — a row that would move a fee axis on an existing
    // student is Blocked, never applied. Surfacing it here rather than at
    // commit is the whole point: the registrar sees WHY and what to do
    // instead before confirming, and nothing is written either way.
    if (match.action === 'update' && match.existing) {
      const conflicts = feeAxisConflicts(match.existing, refs.value, typedRow);
      if (conflicts.length) return { ok: true, action: 'blocked', notes: conflicts, resolved };
    }

    // Report guardian side effects before they happen. Both columns can name
    // the same person, so dedupe within the row — across rows the total is an
    // upper bound, which is why the UI says "up to".
    const notes: string[] = [];
    const phones = new Set(
      ['primaryParentPhone', 'feeResponsibleParentPhone']
        .map((k) => String(typedRow[k] ?? '').trim())
        .filter(Boolean),
    );
    let guardiansToCreate = 0;
    for (const phone of phones) {
      if (!(await parentExistsByPhone(ctx.collegeId, phone))) {
        notes.push(`will create a guardian for ${phone}`);
        guardiansToCreate += 1;
      }
    }

    return {
      ok: true,
      action: match.action,
      notes: notes.length ? notes : undefined,
      resolved,
      sideEffects: guardiansToCreate ? { guardians: guardiansToCreate } : undefined,
    };
  },
  commitOne: (typedRow, ctx) => commitStudentRow(typedRow, ctx),
};
