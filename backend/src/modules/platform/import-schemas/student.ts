import { commitStudentRow, parentExistsByPhone } from '../../people/student-import-service';
import { resolveStudentRefs, validateCatalogCodes } from '../../people/student-import-refs';
import {
  matchExistingStudent, feeAxisConflicts, studentNaturalKeys,
} from '../../people/student-import-match';
import { resolvePinYearOfStudy } from '../../people/student-import-pin';
import {
  previewMatchingFeeStructureInstance,
  type PreviewMatchResult,
} from '../../finance/fee-pin-service';
import { Student } from '../../../models/people/Student';
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
function inr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/** Mirrors the commit-side guard so preview and commit agree on "already pinned". */
async function hasActivePinForYear(
  collegeId: string,
  studentId: string,
  yearOfStudy: number,
): Promise<boolean> {
  const found = await Student.findOne({
    _id: studentId,
    collegeId,
    feePins: { $elemMatch: { yearOfStudy, archivedAt: null } },
  }).select('_id').lean();
  return Boolean(found);
}

/**
 * Resolve the fee structure a row would pin to, reusing the job's memo store.
 *
 * A cohort import repeats the same axis tuple across hundreds of rows, so
 * without this the preview would issue one `FeeStructureInstance` query per
 * row. Keyed on the full tuple because that is exactly what the matcher
 * scores on.
 *
 * Preview only — `previewCache` is absent at commit by design, so a structure
 * superseded between the two calls can never be written as a pin.
 */
async function previewPinMatch(
  collegeId: string,
  academicYearId: string,
  axes: { programmeId: string; branchId?: string; quota?: string; category?: string },
  yearOfStudy: number,
  cache: Map<string, unknown> | undefined,
): Promise<PreviewMatchResult> {
  const key = [
    'fsi', academicYearId, axes.programmeId, axes.branchId ?? '',
    axes.quota ?? '', axes.category ?? '', yearOfStudy,
  ].join('|');
  const memo = cache?.get(key);
  if (memo) return memo as PreviewMatchResult;

  const result = await previewMatchingFeeStructureInstance({
    collegeId, academicYearId, yearOfStudy, ...axes,
  });
  cache?.set(key, result);
  return result;
}

export const studentImportSchema: ImportSchemaDefinition = {
  entityType: 'student',
  label: 'Students',
  requiresPinAcademicYear: true,
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
   * Opt into the engine's whole-file duplicate check. Student is the only
   * schema that upserts, so it is the only one where two rows claiming one
   * identity destroys data instead of merely duplicating it.
   */
  naturalKeys: studentNaturalKeys,
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

    const notes: string[] = [];
    const sideEffects: Record<string, number> = {};

    // Which fee structure this row would bind the student to, and at which
    // year. The year is echoed because `studyYearAtAdmission` is optional: a
    // blank column silently means Year 1, and a mid-lifecycle intake loaded
    // with it blank would pin an entire cohort of third-years to Year 1.
    const pinYear = resolvePinYearOfStudy(typedRow.studyYearAtAdmission);
    if (!pinYear.ok) {
      notes.push(pinYear.error);
      sideEffects.pinError = 1;
    } else if (!ctx.academicYearId) {
      sideEffects.pinNoAcademicYear = 1;
    } else if (match.action === 'update' && match.studentId
      && await hasActivePinForYear(ctx.collegeId, match.studentId, pinYear.yearOfStudy)) {
      // Silent on purpose — nothing is changing for this student.
      sideEffects.pinAlreadyPinned = 1;
    } else {
      const quotaCell = String(typedRow.quota ?? '').trim();
      const categoryCell = String(typedRow.category ?? '').trim();
      const fsiMatch = await previewPinMatch(
        ctx.collegeId,
        ctx.academicYearId,
        {
          programmeId: refs.value.programmeId,
          ...(refs.value.branchId ? { branchId: refs.value.branchId } : {}),
          ...(quotaCell ? { quota: quotaCell } : {}),
          ...(categoryCell ? { category: categoryCell } : {}),
        },
        pinYear.yearOfStudy,
        ctx.previewCache,
      );
      if (fsiMatch.matched && fsiMatch.fsi) {
        const amount = fsiMatch.fsi.totalAmount ?? 0;
        notes.push(`will pin Year ${pinYear.yearOfStudy} → ${inr(amount)}`);
        sideEffects.pinWillPin = 1;
        sideEffects.pinAmount = amount;
      } else {
        notes.push(
          `no matching fee structure for Year ${pinYear.yearOfStudy} `
          + '— will import unpinned',
        );
        sideEffects.pinNoMatch = 1;
      }
    }

    // Report guardian side effects before they happen. Both columns can name
    // the same person, so dedupe within the row — across rows the total is an
    // upper bound, which is why the UI says "up to".
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

    if (guardiansToCreate) sideEffects.guardians = guardiansToCreate;

    return {
      ok: true,
      action: match.action,
      notes: notes.length ? notes : undefined,
      resolved,
      sideEffects: Object.keys(sideEffects).length ? sideEffects : undefined,
    };
  },
  commitOne: (typedRow, ctx) => commitStudentRow(typedRow, ctx),
};
