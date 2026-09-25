import { createHash } from 'node:crypto';
import { User } from '../../../models/User';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { Student } from '../../../models/people/Student';
import { loadPersonas } from '../../../shared/rbac/persona-registry';
import { createUser, updateUser } from '../user-service';
import type { ImportSchemaDefinition } from './types';
import { validString, validEmail, validEnum } from './validators';

/**
 * 010 P2 — bulk user (login) import. Reuses `createUser`/`updateUser` so the
 * role derivation, token-version bump and audit trail are the same as the
 * Users page.
 *
 * A blank password gets a temp one derived from (jobId, email): the same
 * value is shown in the preview note and written at commit without needing
 * a message channel between the two calls.
 */
function tempPassword(jobId: string, email: string): string {
  return createHash('sha256').update(`${jobId}:${email}`).digest('base64url').slice(0, 12);
}

const splitPersonas = (raw: unknown) =>
  String(raw ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);

/** personId for an employeeCode (Faculty, then Staff) or rollNumber; null when nothing matches. */
async function resolvePersonId(
  collegeId: string,
  typedRow: Record<string, unknown>,
): Promise<{ ok: true; personId?: string; label?: string } | { ok: false; error: string }> {
  const code = String(typedRow.employeeCode ?? '').trim();
  const roll = String(typedRow.rollNumber ?? '').trim();
  if (code && roll) return { ok: false, error: 'Give either employeeCode or rollNumber, not both' };
  if (code) {
    const hit = await Faculty.findOne({ collegeId, employeeCode: code }).select('personId').lean()
      ?? await Staff.findOne({ collegeId, employeeCode: code }).select('personId').lean();
    if (!hit?.personId) return { ok: false, error: `No faculty or staff with employeeCode "${code}"` };
    return { ok: true, personId: String(hit.personId), label: `Employee ${code}` };
  }
  if (roll) {
    const hit = await Student.findOne({ collegeId, rollNumber: roll }).select('personId').lean();
    if (!hit?.personId) return { ok: false, error: `No student with rollNumber "${roll}"` };
    return { ok: true, personId: String(hit.personId), label: `Student ${roll}` };
  }
  return { ok: true };
}

export const userImportSchema: ImportSchemaDefinition = {
  entityType: 'user',
  label: 'Users (logins)',
  description:
    'Bulk-create or update portal logins. Personas are comma-separated codes from the persona catalog; '
    + 'the role is derived from them. Rows match on email. A blank password gets a temporary one shown in the preview.',
  fields: [
    { fieldKey: 'email', label: 'Email *', type: 'string', required: true, validate: validEmail({ required: true }) },
    { fieldKey: 'name', label: 'Full Name *', type: 'string', required: true, validate: validString({ required: true, min: 1, max: 120 }) },
    { fieldKey: 'personas', label: 'Personas (comma-separated codes) *', type: 'string', required: true, validate: validString({ required: true, min: 2, max: 400 }) },
    { fieldKey: 'password', label: 'Password (min 8, blank = temporary)', type: 'string', required: false, validate: validString({ required: false, min: 8, max: 128 }) },
    { fieldKey: 'employeeCode', label: 'Employee Code (links Faculty/Staff)', type: 'string', required: false, validate: validString({ required: false, max: 50 }) },
    { fieldKey: 'rollNumber', label: 'Roll Number (links Student)', type: 'string', required: false, validate: validString({ required: false, max: 50 }) },
    { fieldKey: 'isActive', label: 'Active', type: 'enum', required: false, meta: { values: ['true', 'false'] }, validate: validEnum({ required: false, values: ['true', 'false'] }) },
  ],
  sampleRow: {
    email: 'lakshmi.prasad@example.edu', name: 'Dr. Lakshmi Prasad', personas: 'F-FAC',
    password: '', employeeCode: 'FAC004', rollNumber: '', isActive: 'true',
  },
  naturalKeys: (typedRow) => [{ label: 'email', value: String(typedRow.email ?? '').trim().toLowerCase() }],

  async validateRow(typedRow, _rawRow, ctx) {
    const codes = splitPersonas(typedRow.personas);
    const known = new Set((await loadPersonas(ctx.collegeId)).map((p) => p.code));
    const unknown = codes.filter((c) => !known.has(c));
    if (unknown.length) return { ok: true, action: 'blocked', notes: [`Unknown persona(s): ${unknown.join(', ')}`] };

    const person = await resolvePersonId(ctx.collegeId, typedRow);
    if (!person.ok) return { ok: true, action: 'blocked', notes: [person.error] };

    const email = String(typedRow.email).trim().toLowerCase();
    const existing = await User.findOne({ collegeId: ctx.collegeId, email }).select('_id').lean();
    const notes: string[] = [];
    if (!existing && !String(typedRow.password ?? '').trim()) {
      notes.push(`temporary password: ${tempPassword(ctx.jobId, email)}`);
    }
    return {
      ok: true,
      action: existing ? 'update' : 'create',
      notes: notes.length ? notes : undefined,
      resolved: person.label ? { Person: person.label } : undefined,
    };
  },

  async commitOne(typedRow, ctx) {
    const email = String(typedRow.email).trim().toLowerCase();
    const personas = splitPersonas(typedRow.personas);
    const person = await resolvePersonId(ctx.collegeId, typedRow);
    if (!person.ok) throw new Error(person.error);
    const isActiveCell = String(typedRow.isActive ?? '').trim();
    const isActive = isActiveCell ? isActiveCell === 'true' : undefined;
    const name = String(typedRow.name).trim();
    // ponytail: the commit context carries no caller role; college admins run imports, and
    // createUser still refuses a super-admin persona for 'admin'.
    const callerRole = 'admin';

    const existing = await User.findOne({ collegeId: ctx.collegeId, email }).select('_id').lean();
    if (existing) {
      const doc = await updateUser(ctx.collegeId, String(existing._id), {
        name, personas, ...(person.personId ? { personId: person.personId } : {}), ...(isActive !== undefined ? { isActive } : {}),
      }, ctx.performedBy, callerRole);
      return { id: String((doc as { _id: unknown })._id) };
    }
    const password = String(typedRow.password ?? '').trim() || tempPassword(ctx.jobId, email);
    const doc = await createUser(ctx.collegeId, {
      email, name, personas, password, personId: person.personId, ...(isActive !== undefined ? { isActive } : {}),
    }, ctx.performedBy, callerRole);
    return { id: String((doc as { _id: unknown })._id) };
  },
};
