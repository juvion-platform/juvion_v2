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
 * created/changed and undo it in reverse order on failure — deletes for new
 * documents, snapshot-restores for documents that were merely mutated (the
 * `update` match path rewrites an existing Person/Student in place).
 */
import { Person } from '../../models/people/Person';
import { Student } from '../../models/people/Student';
import { Parent } from '../../models/people/Parent';
import { Faculty } from '../../models/people/Faculty';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { syncStudentParentLinks } from './service';
import { resolveStudentRefs, validateCatalogCodes, ResolvedRefs } from './student-import-refs';
import { matchExistingStudent, feeAxisConflicts } from './student-import-match';

interface Ctx { collegeId: string; performedBy: string; }

/**
 * One undo step for a single row's commit. `create` steps are undone with a
 * delete; `restore` steps are undone by putting an EXISTING document's
 * mutated fields back to their pre-update values (an unset path is put back
 * to unset via `$unset`, not `$set: undefined` — Mongoose drops `undefined`
 * from update payloads, so a bare `$set` cannot resurrect "was absent").
 */
type Compensation =
  | { kind: 'create'; model: 'Person' | 'Parent' | 'Student'; id: unknown }
  | {
      kind: 'restore';
      model: 'Person' | 'Student';
      id: unknown;
      set: Record<string, unknown>;
      unset: Record<string, ''>;
    }
  /**
   * Reverse Parent -> Student links. Undone by re-running the same
   * reconciliation with the two id sets swapped, which restores exactly the
   * prior membership. Unlike the other two kinds this one is registered
   * BEFORE its forward write: `syncStudentParentLinks` issues two updateMany
   * calls (pull, then addToSet) and a failure between them would otherwise
   * leave a half-applied change with no compensation. Registering early is
   * safe precisely because the undo is a set reconciliation, not a delete —
   * running it when the forward write never happened is a no-op.
   */
  | { kind: 'parentLinks'; studentId: string; previous: string[]; next: string[] };

function cell(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

/** A few natural-key-ish values to make a rollback-failure log line actionable. */
function rowIdentity(row: Record<string, unknown>): Record<string, string> {
  return {
    name: cell(row, 'name'),
    phone: cell(row, 'phone'),
    rollNumber: cell(row, 'rollNumber'),
    aadhaar: cell(row, 'aadhaar'),
  };
}

function readDotted(source: Record<string, unknown>, path: string): unknown {
  let cur: unknown = source;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/**
 * Splits a proposed `$set` into `{ set, unset }` against an existing
 * document's CURRENT values, so rollback can restore exactly the pre-update
 * state — including un-setting a path that did not exist before.
 */
function snapshotFor(
  existing: Record<string, unknown>,
  fields: Record<string, unknown>,
): { set: Record<string, unknown>; unset: Record<string, ''> } {
  const set: Record<string, unknown> = {};
  const unset: Record<string, ''> = {};
  for (const key of Object.keys(fields)) {
    const prev = readDotted(existing, key);
    if (prev === undefined) unset[key] = '';
    else set[key] = prev;
  }
  return { set, unset };
}

async function rollback(
  compensations: Compensation[],
  collegeId: string,
  row: Record<string, unknown>,
): Promise<void> {
  for (let i = compensations.length - 1; i >= 0; i -= 1) {
    const c = compensations[i]!;
    try {
      if (c.kind === 'create') {
        if (c.model === 'Person') await Person.deleteOne({ _id: c.id, collegeId });
        else if (c.model === 'Parent') await Parent.deleteOne({ _id: c.id, collegeId });
        else await Student.deleteOne({ _id: c.id, collegeId });
      } else if (c.kind === 'parentLinks') {
        await syncStudentParentLinks(collegeId, c.studentId, c.next, c.previous);
      } else {
        const update: Record<string, unknown> = {};
        if (Object.keys(c.set).length) update.$set = c.set;
        if (Object.keys(c.unset).length) update.$unset = c.unset;
        if (Object.keys(update).length) {
          if (c.model === 'Person') await Person.updateOne({ _id: c.id, collegeId }, update);
          else await Student.updateOne({ _id: c.id, collegeId }, update);
        }
      }
    } catch (rollbackErr) {
      // Best-effort. A failed compensation must not mask the original error
      // — but silently swallowing it produces exactly the untraceable
      // orphan/stale record this task exists to prevent, so log everything
      // needed to find it by hand: which doc, which row, what went wrong.
      console.error(
        '[student-import] compensation failed — possible orphan or stale record',
        {
          collegeId,
          kind: c.kind,
          model: c.kind === 'parentLinks' ? 'Parent' : c.model,
          id: c.kind === 'parentLinks' ? c.studentId : String(c.id),
          row: rowIdentity(row),
          error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
        },
      );
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
 * record silently. Instead: exclude Persons known to play a different role
 * (Student, Faculty) FIRST, then prefer an existing Parent among what's
 * left. Excluding before searching for an existing Parent also means a
 * legacy self-guardian Parent record (e.g. from before this rule existed)
 * is never re-linked — it's healed by falling through to a fresh,
 * non-student/non-faculty guardian instead.
 */
async function linkOrCreateParent(
  collegeId: string,
  phone: string,
  name: string,
  compensations: Compensation[],
  performedBy: string,
): Promise<string> {
  const persons = await Person.find({ collegeId, phone }).select('_id name').lean();
  const ids = persons.map((p) => p._id);

  if (ids.length) {
    const [studentMatches, facultyMatches] = await Promise.all([
      Student.find({ collegeId, personId: { $in: ids } }).select('personId').lean(),
      Faculty.find({ collegeId, personId: { $in: ids } }).select('personId').lean(),
    ]);
    const excluded = new Set<string>([
      ...studentMatches.map((s) => String(s.personId)),
      ...facultyMatches.map((f) => String(f.personId)),
    ]);
    const eligible = persons.filter((p) => !excluded.has(String(p._id)));

    if (eligible.length) {
      const eligibleIds = eligible.map((p) => p._id);
      const existingParent = await Parent.findOne({
        collegeId, personId: { $in: eligibleIds },
      }).select('_id').lean();
      if (existingParent) return String(existingParent._id);

      const target = eligible[0]!;
      const parent = await Parent.create({ collegeId, personId: target._id, relationship: 'guardian' });
      compensations.push({ kind: 'create', model: 'Parent', id: parent._id });
      await createAuditLog({
        collegeId, entityType: 'Parent', entityId: String(parent._id),
        entityName: target.name, action: 'create', changes: [], performedBy,
      });
      return String(parent._id);
    }
    // else every matching Person is a Student or Faculty member — fall
    // through and create a fresh guardian Person + Parent below.
  }

  const person = await Person.create({ collegeId, name: name || `Guardian ${phone}`, phone });
  compensations.push({ kind: 'create', model: 'Person', id: person._id });
  const parent = await Parent.create({ collegeId, personId: person._id, relationship: 'guardian' });
  compensations.push({ kind: 'create', model: 'Parent', id: parent._id });
  await createAuditLog({
    collegeId, entityType: 'Parent', entityId: String(parent._id),
    entityName: person.name, action: 'create', changes: [], performedBy,
  });
  return String(parent._id);
}

/**
 * Read-only counterpart to linkOrCreateParent, for preview. Answers "would
 * this row create a guardian?" without writing anything. Mirrors
 * linkOrCreateParent's exclusion-then-prefer-existing-Parent rule exactly,
 * so preview's guardian count agrees with what commit will actually do —
 * including the legacy-self-guardian healing case: a Parent attached to a
 * Student/Faculty Person must not read as "a guardian already exists"
 * here, or preview would say "0 will be created" while commit creates one.
 */
export async function parentExistsByPhone(collegeId: string, phone: string): Promise<boolean> {
  const persons = await Person.find({ collegeId, phone }).select('_id').lean();
  if (!persons.length) return false;
  const ids = persons.map((p) => p._id);

  const [studentMatches, facultyMatches] = await Promise.all([
    Student.find({ collegeId, personId: { $in: ids } }).select('personId').lean(),
    Faculty.find({ collegeId, personId: { $in: ids } }).select('personId').lean(),
  ]);
  const excluded = new Set<string>([
    ...studentMatches.map((s) => String(s.personId)),
    ...facultyMatches.map((f) => String(f.personId)),
  ]);
  const eligibleIds = ids.filter((id) => !excluded.has(String(id)));
  if (!eligibleIds.length) return false;

  const existingParent = await Parent.findOne({
    collegeId, personId: { $in: eligibleIds },
  }).select('_id').lean();
  return Boolean(existingParent);
}

/**
 * Full field set for creating a brand-new Person. There is no prior data to
 * overwrite, so an `address` object whose unsupplied sub-fields collapse to
 * `undefined` (and are stripped by Mongoose, leaving `{}`) is harmless.
 */
function personCreateFields(row: Record<string, unknown>): Record<string, unknown> {
  return {
    name: cell(row, 'name'),
    phone: cell(row, 'phone'),
    ...(cell(row, 'email') ? { email: cell(row, 'email') } : {}),
    ...(cell(row, 'gender') ? { gender: cell(row, 'gender') } : {}),
    ...(cell(row, 'dob') ? { dob: new Date(cell(row, 'dob')) } : {}),
    ...(cell(row, 'aadhaar') ? { aadhaar: cell(row, 'aadhaar') } : {}),
    address: {
      line1: cell(row, 'addressLine1') || undefined,
      line2: cell(row, 'addressLine2') || undefined,
      city: cell(row, 'city') || undefined,
      state: cell(row, 'state') || undefined,
      pincode: cell(row, 'pincode') || undefined,
    },
  };
}

/**
 * Fields to `$set` on an EXISTING Person — only columns the row actually
 * supplied. Spec: "match found; the row's supplied fields are applied."
 * `address` sub-fields are dotted paths (`address.line1`, ...) rather than
 * a nested object, so a re-import that only touches, say, `rollNumber` can
 * never `$set` the whole `address` subdocument and silently wipe a
 * previously-stored value the row didn't even carry a column for.
 */
function personUpdateFields(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const name = cell(row, 'name'); if (name) out.name = name;
  const phone = cell(row, 'phone'); if (phone) out.phone = phone;
  const email = cell(row, 'email'); if (email) out.email = email;
  const gender = cell(row, 'gender'); if (gender) out.gender = gender;
  const dob = cell(row, 'dob'); if (dob) out.dob = new Date(dob);
  const aadhaar = cell(row, 'aadhaar'); if (aadhaar) out.aadhaar = aadhaar;
  const line1 = cell(row, 'addressLine1'); if (line1) out['address.line1'] = line1;
  const line2 = cell(row, 'addressLine2'); if (line2) out['address.line2'] = line2;
  const city = cell(row, 'city'); if (city) out['address.city'] = city;
  const state = cell(row, 'state'); if (state) out['address.state'] = state;
  const pincode = cell(row, 'pincode'); if (pincode) out['address.pincode'] = pincode;
  return out;
}

/**
 * Student fields, shared by create and update, differing only in `status`'s
 * default. Every field besides `programmeId` is included only when the row
 * actually supplied it — `programmeId` is the one exception because
 * `resolveStudentRefs` requires `programmeCode` on every row, so it is
 * always a "supplied" field in spec terms.
 */
function studentFieldsFromRow(
  row: Record<string, unknown>,
  refs: ResolvedRefs,
  primaryParentId: string | undefined,
  feeResponsibleParentId: string | undefined,
  mode: 'create' | 'update',
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    programmeId: refs.programmeId,
  };
  if (refs.branchId) out.branchId = refs.branchId;
  if (refs.batchId) out.batchId = refs.batchId;
  if (refs.regulationId) out.regulationId = refs.regulationId;

  // A blank admissionYear must be treated as absent, not coerced to 0 by
  // `Number('')`. Left unconditional, it would silently write a nonsensical
  // admissionYear on create and clobber the real one on update, and would
  // also corrupt the phone+admissionYear natural key used elsewhere to
  // match rows back to an existing Student.
  const admissionYearRaw = cell(row, 'admissionYear');
  if (admissionYearRaw) out.admissionYear = Number(admissionYearRaw);

  const rollNumber = cell(row, 'rollNumber'); if (rollNumber) out.rollNumber = rollNumber;
  const quota = cell(row, 'quota'); if (quota) out.quota = quota;
  const category = cell(row, 'category'); if (category) out.category = category;
  const studyYearRaw = cell(row, 'studyYearAtAdmission');
  if (studyYearRaw) out.studyYearAtAdmission = Number(studyYearRaw);

  const statusRaw = cell(row, 'status');
  if (mode === 'create') {
    // Imported students are normally already admitted; matches the
    // pre-existing importer rather than the model default of 'prospective'.
    // This default is CREATE-only by spec ("an imported student is
    // normally already admitted") — it does not apply on update.
    out.status = statusRaw || 'active';
  } else if (statusRaw) {
    // On update, only overwrite status if the row actually supplies one.
    // `year_back`/`withdrawn`/`expelled`/`deceased` are not in
    // BLOCKED_STATUSES, so defaulting here would silently flip a student
    // back to 'active' on every re-import row that omits a status column.
    out.status = statusRaw;
  }

  // NOTE: `onboardingStatus` is deliberately absent and must stay absent.
  // It is not in the importable field set (see import-schemas/student.ts)
  // because writing it here bypasses assertStudentOnboardingRules and
  // `onboardingCompletedAt`. This allow-list is the second line of defence:
  // even a typedRow that somehow carried the key cannot write it.
  if (primaryParentId) out.primaryParentId = primaryParentId;
  if (feeResponsibleParentId) out.feeResponsibleParentId = feeResponsibleParentId;

  return out;
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

  // Owner ruling A. Preview already resolves these rows to Blocked (see
  // studentImportSchema.validateRow), so a row reaching here with a fee-axis
  // conflict means the DB moved between preview and commit. Re-check rather
  // than trust the preview verdict: this is the write path, and a silent
  // programme/branch/quota/category move desynchronises Student.feePins with
  // no marker to find it by. See feeAxisConflicts() for the full rationale.
  if (match.action === 'update' && match.existing) {
    const conflicts = feeAxisConflicts(match.existing, refs.value, typedRow);
    if (conflicts.length) throw new AppError(409, `Cannot import: ${conflicts.join(' ')}`);
  }

  const compensations: Compensation[] = [];
  try {
    // Guardians first — the Student references them.
    let primaryParentId: string | undefined;
    let feeResponsibleParentId: string | undefined;

    const primaryPhone = cell(typedRow, 'primaryParentPhone');
    if (primaryPhone) {
      primaryParentId = await linkOrCreateParent(
        collegeId, primaryPhone, cell(typedRow, 'primaryParentName'), compensations, performedBy,
      );
    }
    const feePhone = cell(typedRow, 'feeResponsibleParentPhone');
    if (feePhone) {
      feeResponsibleParentId = feePhone === primaryPhone
        ? primaryParentId
        : await linkOrCreateParent(collegeId, feePhone, '', compensations, performedBy);
    }

    if (match.action === 'update') {
      if (!match.studentId) {
        throw new AppError(500, 'matchExistingStudent returned "update" without a studentId');
      }
      const existingStudent = await Student.findOne({ _id: match.studentId, collegeId });
      if (!existingStudent) throw new AppError(404, 'Matched student disappeared mid-import');
      const existingPerson = await Person.findOne({ _id: existingStudent.personId, collegeId });
      if (!existingPerson) throw new AppError(404, 'Matched student has no person record');

      const personSet = personUpdateFields(typedRow);
      if (Object.keys(personSet).length) {
        const { set, unset } = snapshotFor(
          existingPerson.toObject() as unknown as Record<string, unknown>, personSet,
        );
        await Person.updateOne({ _id: existingPerson._id, collegeId }, { $set: personSet });
        compensations.push({ kind: 'restore', model: 'Person', id: existingPerson._id, set, unset });
      }

      const studentSet = studentFieldsFromRow(
        typedRow, refs.value, primaryParentId, feeResponsibleParentId, 'update',
      );
      if (Object.keys(studentSet).length) {
        const { set, unset } = snapshotFor(
          existingStudent.toObject() as unknown as Record<string, unknown>, studentSet,
        );
        await Student.updateOne({ _id: existingStudent._id, collegeId }, { $set: studentSet });
        compensations.push({ kind: 'restore', model: 'Student', id: existingStudent._id, set, unset });
      }

      // Keep Parent.linkedStudents in step, exactly as the manual update
      // path does (people/service.ts:480). `existingStudent` was read before
      // the write above, so it still holds the pre-update guardian ids; a
      // guardian the row replaces is unlinked, not merely left behind.
      const previousParentIds = [
        existingStudent.primaryParentId, existingStudent.feeResponsibleParentId,
      ].filter(Boolean).map(String);
      const nextParentIds = [
        primaryParentId ?? (existingStudent.primaryParentId
          ? String(existingStudent.primaryParentId) : undefined),
        feeResponsibleParentId ?? (existingStudent.feeResponsibleParentId
          ? String(existingStudent.feeResponsibleParentId) : undefined),
      ].filter((v): v is string => Boolean(v));
      if (previousParentIds.length || nextParentIds.length) {
        compensations.push({
          kind: 'parentLinks',
          studentId: String(existingStudent._id),
          previous: previousParentIds,
          next: nextParentIds,
        });
        await syncStudentParentLinks(
          collegeId, String(existingStudent._id), previousParentIds, nextParentIds,
        );
      }

      await createAuditLog({
        collegeId, entityType: 'Student', entityId: String(existingStudent._id),
        entityName: (personSet.name as string | undefined) ?? existingPerson.name,
        action: 'update', changes: [], performedBy,
      });
      return { id: String(existingStudent._id) };
    }

    const person = await Person.create({ collegeId, ...personCreateFields(typedRow) });
    compensations.push({ kind: 'create', model: 'Person', id: person._id });

    const studentFields = studentFieldsFromRow(
      typedRow, refs.value, primaryParentId, feeResponsibleParentId, 'create',
    );
    const student = await Student.create({ collegeId, ...studentFields, personId: person._id });
    compensations.push({ kind: 'create', model: 'Student', id: student._id });

    // Same reverse link the manual create path maintains
    // (people/service.ts:334). Without it every imported guardian reads as
    // childless in parent search and scores 0 for "Linked students".
    const newParentIds = [primaryParentId, feeResponsibleParentId]
      .filter((v): v is string => Boolean(v));
    if (newParentIds.length) {
      compensations.push({
        kind: 'parentLinks', studentId: String(student._id), previous: [], next: newParentIds,
      });
      await syncStudentParentLinks(collegeId, String(student._id), [], newParentIds);
    }

    await createAuditLog({
      collegeId, entityType: 'Student', entityId: String(student._id),
      entityName: person.name, action: 'create', changes: [], performedBy,
    });

    return { id: String(student._id) };
  } catch (err) {
    await rollback(compensations, collegeId, typedRow);
    throw err;
  }
}
