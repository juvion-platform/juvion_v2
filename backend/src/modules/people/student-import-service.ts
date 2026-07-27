/**
 * Commit handler for the student bulk import.
 *
 * A single row can create up to three documents — Person, optionally
 * Parent + its Person, then Student. If the Student write fails (duplicate
 * rollNumber is the realistic case) the Person is already committed and
 * becomes an orphan; across a large file that is meaningful pollution, and it
 * is the only path here that corrupts data rather than merely rejecting input.
 *
 * The in-memory test harness is not a replica set, so session.withTransaction
 * is unavailable. This follows the compensating-rollback precedent documented
 * in modules/finance/programme-transfer-service.ts: track what this row
 * created and delete it in reverse order on failure.
 */
import { Person } from '../../models/people/Person';
import { Student } from '../../models/people/Student';
import { Parent } from '../../models/people/Parent';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { resolveStudentRefs, validateCatalogCodes } from './student-import-refs';
import { matchExistingStudent } from './student-import-match';

interface Ctx { collegeId: string; performedBy: string; }

/** Documents created while processing one row, newest last. */
interface Created { model: 'Person' | 'Parent' | 'Student'; id: unknown; }

function cell(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

async function rollback(created: Created[]): Promise<void> {
  for (let i = created.length - 1; i >= 0; i -= 1) {
    const c = created[i]!;
    try {
      if (c.model === 'Person') await Person.deleteOne({ _id: c.id });
      else if (c.model === 'Parent') await Parent.deleteOne({ _id: c.id });
      else await Student.deleteOne({ _id: c.id });
    } catch {
      // Best-effort. A failed compensation must not mask the original error.
    }
  }
}

/**
 * Link a guardian by phone, creating a minimal Parent + Person when absent.
 * Intake genuinely arrives parent-first and feeResponsibleParentId gates
 * onboarding completion, so requiring a prior parent import would make the
 * feature unusable for its main case.
 *
 * OWNER-APPROVED OVERRIDE: a naive `Person.findOne({ collegeId, phone })`
 * is wrong here. In Indian intake the student's own phone is very often the
 * family phone, so on a re-import — where the student's own Person already
 * exists — that lookup can return the STUDENT's own Person and attach a
 * Parent record to it, making the student their own guardian. Re-import is
 * the headline workflow for this feature, so this is not a corner case, and
 * `feeResponsibleParentId` gates onboarding completion, so it corrupts a
 * record silently. Instead: prefer a Person who is already a guardian, and
 * never let a Person known to be a Student become one.
 */
async function linkOrCreateParent(
  collegeId: string,
  phone: string,
  name: string,
  created: Created[],
): Promise<string> {
  const persons = await Person.find({ collegeId, phone }).select('_id').lean();
  const ids = persons.map((p) => p._id);

  if (ids.length) {
    const existingParent = await Parent.findOne({
      collegeId, personId: { $in: ids },
    }).select('_id').lean();
    if (existingParent) return String(existingParent._id);

    // Any of these Persons that is a Student must not become a guardian.
    const studentIds = (await Student.find({
      collegeId, personId: { $in: ids },
    }).select('personId').lean()).map((s) => String(s.personId));

    const free = ids.find((id) => !studentIds.includes(String(id)));
    if (free) {
      const parent = await Parent.create({ collegeId, personId: free, relationship: 'guardian' });
      created.push({ model: 'Parent', id: parent._id });
      return String(parent._id);
    }
    // else fall through and create a fresh guardian Person + Parent
  }

  const person = await Person.create({ collegeId, name: name || `Guardian ${phone}`, phone });
  created.push({ model: 'Person', id: person._id });
  const parent = await Parent.create({ collegeId, personId: person._id, relationship: 'guardian' });
  created.push({ model: 'Parent', id: parent._id });
  return String(parent._id);
}

/**
 * Read-only counterpart to linkOrCreateParent, for preview. Answers "would
 * this row create a guardian?" without writing anything.
 *
 * Matches linkOrCreateParent's "prefer an existing Parent among every
 * Person on this phone" rule so preview's guardian count agrees with what
 * commit will actually do. This function never creates a new Person, so the
 * "never count a student as a guardian" half of the override doesn't apply
 * here — there is nothing to wrongly attach.
 */
export async function parentExistsByPhone(collegeId: string, phone: string): Promise<boolean> {
  const persons = await Person.find({ collegeId, phone }).select('_id').lean();
  if (!persons.length) return false;
  const ids = persons.map((p) => p._id);
  const existingParent = await Parent.findOne({
    collegeId, personId: { $in: ids },
  }).select('_id').lean();
  return Boolean(existingParent);
}

export async function commitStudentRow(
  typedRow: Record<string, unknown>,
  ctx: Ctx,
): Promise<{ id: string }> {
  const { collegeId, performedBy } = ctx;

  const catalog = await validateCatalogCodes(collegeId, typedRow);
  if (!catalog.ok) throw new AppError(400, catalog.error);

  const refs = await resolveStudentRefs(collegeId, typedRow);
  if (!refs.ok) throw new AppError(400, refs.error);

  const match = await matchExistingStudent(collegeId, typedRow);
  if (match.action === 'blocked') {
    throw new AppError(409, `Cannot import: ${match.reason}`);
  }

  const created: Created[] = [];
  try {
    // Guardians first — the Student references them.
    let primaryParentId: string | undefined;
    let feeResponsibleParentId: string | undefined;

    const primaryPhone = cell(typedRow, 'primaryParentPhone');
    if (primaryPhone) {
      primaryParentId = await linkOrCreateParent(
        collegeId, primaryPhone, cell(typedRow, 'primaryParentName'), created,
      );
    }
    const feePhone = cell(typedRow, 'feeResponsibleParentPhone');
    if (feePhone) {
      feeResponsibleParentId = feePhone === primaryPhone
        ? primaryParentId
        : await linkOrCreateParent(collegeId, feePhone, '', created);
    }

    const personFields = {
      name: cell(typedRow, 'name'),
      phone: cell(typedRow, 'phone'),
      ...(cell(typedRow, 'email') ? { email: cell(typedRow, 'email') } : {}),
      ...(cell(typedRow, 'gender') ? { gender: cell(typedRow, 'gender') } : {}),
      ...(cell(typedRow, 'dob') ? { dob: new Date(cell(typedRow, 'dob')) } : {}),
      ...(cell(typedRow, 'aadhaar') ? { aadhaar: cell(typedRow, 'aadhaar') } : {}),
      address: {
        line1: cell(typedRow, 'addressLine1') || undefined,
        line2: cell(typedRow, 'addressLine2') || undefined,
        city: cell(typedRow, 'city') || undefined,
        state: cell(typedRow, 'state') || undefined,
        pincode: cell(typedRow, 'pincode') || undefined,
      },
    };

    const studentFields: Record<string, unknown> = {
      collegeId,
      admissionYear: Number(cell(typedRow, 'admissionYear')),
      programmeId: refs.value.programmeId,
      ...(refs.value.branchId ? { branchId: refs.value.branchId } : {}),
      ...(refs.value.batchId ? { batchId: refs.value.batchId } : {}),
      ...(refs.value.regulationId ? { regulationId: refs.value.regulationId } : {}),
      ...(cell(typedRow, 'rollNumber') ? { rollNumber: cell(typedRow, 'rollNumber') } : {}),
      ...(cell(typedRow, 'quota') ? { quota: cell(typedRow, 'quota') } : {}),
      ...(cell(typedRow, 'category') ? { category: cell(typedRow, 'category') } : {}),
      ...(cell(typedRow, 'studyYearAtAdmission')
        ? { studyYearAtAdmission: Number(cell(typedRow, 'studyYearAtAdmission')) } : {}),
      // Imported students are normally already admitted; matches the
      // pre-existing importer rather than the model default of 'prospective'.
      status: cell(typedRow, 'status') || 'active',
      ...(cell(typedRow, 'onboardingStatus') ? { onboardingStatus: cell(typedRow, 'onboardingStatus') } : {}),
      ...(primaryParentId ? { primaryParentId } : {}),
      ...(feeResponsibleParentId ? { feeResponsibleParentId } : {}),
    };

    if (match.action === 'update' && match.studentId) {
      const existing = await Student.findOne({ _id: match.studentId, collegeId });
      if (!existing) throw new AppError(404, 'Matched student disappeared mid-import');
      await Person.updateOne({ _id: existing.personId, collegeId }, { $set: personFields });
      const { collegeId: _c, ...updatable } = studentFields;
      await Student.updateOne({ _id: existing._id, collegeId }, { $set: updatable });
      await createAuditLog({
        collegeId, entityType: 'Student', entityId: String(existing._id),
        entityName: personFields.name, action: 'update', changes: [], performedBy,
      });
      return { id: String(existing._id) };
    }

    const person = await Person.create({ collegeId, ...personFields });
    created.push({ model: 'Person', id: person._id });

    const student = await Student.create({ ...studentFields, personId: person._id });
    created.push({ model: 'Student', id: student._id });

    await createAuditLog({
      collegeId, entityType: 'Student', entityId: String(student._id),
      entityName: personFields.name, action: 'create', changes: [], performedBy,
    });

    return { id: String(student._id) };
  } catch (err) {
    await rollback(created);
    throw err;
  }
}
