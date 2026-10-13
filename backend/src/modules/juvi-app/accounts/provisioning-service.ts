import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { User, IUser } from '../../../models/User';
import { College } from '../../../models/College';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { Department } from '../../../models/academic-structure/Department';
import { Branch } from '../../../models/academic-structure/Branch';
import { Section } from '../../../models/academic-structure/Section';
import { JuviAccount, IJuviAccount, AccountKind, AccountStatus, TransitionSource } from '../../../models/juvi/JuviAccount';
import { ChannelMembership } from '../../../models/juvi/ChannelMembership';
import { createAuditLog } from '../../../shared/audit';
import { generateTemporaryPassword } from './temp-password';
import { storeCredential } from './credential-store';
import { revokeOtherSessions } from './session-service';
import { getJuviConfig, normalizeJuviConfig } from '../config/institution-config';
import { MobileApiError, notFound } from '../errors';
import { onAccountActivated } from '../notices/recipient-service';
import { AppError } from '../../../middleware/errorHandler';
import { CANONICAL_JUVI_ID, mintJuviId, normaliseJuviId } from './juvi-id';

export interface ProvisionPersonInput {
  collegeId: string;
  personId: string;
  kind: AccountKind;
  source: TransitionSource;
  performedBy: string;
  /** Default true. When false an existing User keeps its password and flag. */
  resetPassword?: boolean;
  runId?: string | null;
  /** Seed/dev only: use this temporary password instead of generating one. */
  temporaryPassword?: string;
  /** Seed/dev only: mint this Juvi ID instead of drawing one. Mirrors `temporaryPassword`. */
  juviId?: string;
}

export interface ProvisionPersonResult {
  account: IJuviAccount;
  created: boolean;
  userCreated: boolean;
  credentialId?: string;
}

/** `.invalid` is a reserved TLD (RFC 2606): the address can never receive mail. */
export function placeholderEmail(identifier: string, collegeCode: string): string {
  const safe = identifier.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase() || 'user';
  return `${safe}@no-email.${collegeCode.toLowerCase()}.juvion.invalid`;
}

interface KindRow {
  entityId: Types.ObjectId;
  identifier: string;
  sectionId?: Types.ObjectId;
  batchId?: Types.ObjectId;
  departmentId?: Types.ObjectId;
  role: string;
  personaType: string;
}

/** `.lean()` types an ObjectId path as `FlattenMaps<ObjectId>`; identical at runtime. */
function asObjectId(v: unknown): Types.ObjectId;
function asObjectId(v: unknown | undefined): Types.ObjectId | undefined;
function asObjectId(v: unknown | undefined): Types.ObjectId | undefined {
  return v === undefined || v === null ? undefined : (v as Types.ObjectId);
}

async function loadKindRow(collegeId: string, personId: string, kind: AccountKind): Promise<KindRow> {
  if (kind === 'student') {
    const s = await Student.findOne({ collegeId, personId }).select('_id rollNumber batchId branchId').lean();
    if (!s) throw new MobileApiError(404, 'NOT_FOUND', 'Person has no student record');
    const section = await Section.findOne({ collegeId, studentIds: s._id }).select('_id').lean();
    const branch = s.branchId ? await Branch.findOne({ _id: s.branchId, collegeId }).select('departmentId').lean() : null;
    return {
      entityId: asObjectId(s._id), identifier: s.rollNumber ?? String(s._id), sectionId: asObjectId(section?._id), batchId: asObjectId(s.batchId),
      departmentId: asObjectId(branch?.departmentId), role: 'student', personaType: 'L-STU',
    };
  }
  if (kind === 'faculty') {
    const f = await Faculty.findOne({ collegeId, personId }).select('_id employeeCode departmentId').lean();
    if (!f) throw new MobileApiError(404, 'NOT_FOUND', 'Person has no faculty record');
    const isHod = await Department.exists({ collegeId, hodId: f._id });
    return {
      entityId: asObjectId(f._id), identifier: f.employeeCode, departmentId: asObjectId(f.departmentId),
      role: isHod ? 'hod' : 'faculty', personaType: isHod ? 'F-HOD' : 'F-FAC',
    };
  }
  const st = await Staff.findOne({ collegeId, personId }).select('_id employeeCode departmentId personaCode').lean();
  if (!st) throw new MobileApiError(404, 'NOT_FOUND', 'Person has no staff record');
  return {
    entityId: asObjectId(st._id), identifier: st.employeeCode, departmentId: asObjectId(st.departmentId),
    role: 'staff', personaType: st.personaCode ?? 'ST-REG',
  };
}

/** Bounded: the unique index is the guarantee, and a loop that never ends is not a retry. */
const MINT_ATTEMPTS = 5;

function isDuplicateKey(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: number }).code === 11000;
}

/**
 * Give this User a Juvi ID if it has none, and return whichever one it ends up holding.
 *
 * `updateOne` with `juviId: { $exists: false }` in the filter, rather than assigning the
 * field and saving: a duplicate-key error on a `save()` leaves the in-memory document
 * ambiguous about what is actually stored, and the retry then works from a lie.
 *
 * The caller-supplied `juviId` (seed/dev) is taken as given — a collision there is a
 * configuration mistake to be shouted about, not a random draw to retry.
 */
export async function ensureJuviId(input: { collegeId: string; userId: string; juviId?: string }): Promise<string> {
  const scope = { _id: input.userId, collegeId: input.collegeId };
  const readBack = async (): Promise<string | null> =>
    (await User.findOne(scope).select('juviId').lean())?.juviId ?? null;

  const current = await readBack();
  if (current) return current;

  if (input.juviId !== undefined) {
    const canonical = normaliseJuviId(input.juviId);
    if (!CANONICAL_JUVI_ID.test(canonical)) {
      throw new AppError(400, `juviId override must look like JUV-4K7P-2M9X, got "${input.juviId}"`);
    }
    const res = await User.updateOne({ ...scope, juviId: { $exists: false } }, { $set: { juviId: canonical } });
    if (res.modifiedCount === 1) return canonical;
    const settled = await readBack();
    if (settled === canonical) return canonical;
    if (settled) throw new Error(`User ${input.userId} already holds juviId ${settled}`);
    throw notFound('User');
  }

  for (let attempt = 0; attempt < MINT_ATTEMPTS; attempt += 1) {
    const candidate = mintJuviId();
    try {
      const res = await User.updateOne({ ...scope, juviId: { $exists: false } }, { $set: { juviId: candidate } });
      if (res.modifiedCount === 1) return candidate;
      // Nothing modified: a concurrent call stored one first, or the User is gone.
      const settled = await readBack();
      if (settled) return settled;
      throw notFound('User');
    } catch (e) {
      if (isDuplicateKey(e)) continue;
      throw e;
    }
  }
  throw new AppError(500, `Could not mint a Juvi ID after ${MINT_ATTEMPTS} attempts`);
}

/** `JUV4K7P2M9X` for a User that has one; `null` when it does not. */
export async function readJuviId(collegeId: string, userId: string): Promise<string | null> {
  return (await User.findOne({ _id: userId, collegeId }).select('juviId').lean())?.juviId ?? null;
}

export async function provisionPerson(input: ProvisionPersonInput): Promise<ProvisionPersonResult> {
  const resetPassword = input.resetPassword ?? true;
  const person = await Person.findOne({ _id: input.personId, collegeId: input.collegeId }).select('name email').lean();
  if (!person) throw notFound('Person');
  const college = await College.findById(input.collegeId).select('code juvi').lean();
  if (!college) throw notFound('College');
  const row = await loadKindRow(input.collegeId, input.personId, input.kind);

  // The User is loaded before the early return: an account that predates the Juvi ID still
  // needs one, so re-provisioning is a repair path, not just an idempotent no-op (ruling R-F).
  let user: IUser | null = await User.findOne({ collegeId: input.collegeId, personId: input.personId });

  // Existing account: nothing else to do (idempotent).
  const existing = await JuviAccount.findOne({ collegeId: input.collegeId, personId: input.personId });
  if (existing) {
    if (user) await ensureJuviId({ collegeId: input.collegeId, userId: String(user._id), juviId: input.juviId });
    return { account: existing, created: false, userCreated: false };
  }
  let userCreated = false;
  let temporaryPassword: string | undefined;

  if (!user) {
    temporaryPassword = input.temporaryPassword ?? generateTemporaryPassword();
    user = await User.create({
      collegeId: input.collegeId,
      email: (person.email ?? '').trim().toLowerCase() || placeholderEmail(row.identifier, college.code),
      password: await bcrypt.hash(temporaryPassword, 10),
      name: person.name,
      role: row.role,
      personaType: row.personaType,
      personId: input.personId,
      isActive: true,
      mustChangePassword: true,
    });
    userCreated = true;
  } else if (resetPassword) {
    // Never re-open an ERP login an admin disabled (the User is shared with the ERP web login).
    if (user.isActive === false) {
      throw new MobileApiError(403, 'ACCOUNT_DEACTIVATED', 'ERP login is disabled for this person');
    }
    temporaryPassword = input.temporaryPassword ?? generateTemporaryPassword();
    user.password = await bcrypt.hash(temporaryPassword, 10);
    user.mustChangePassword = true;
    await user.save();
  }

  await ensureJuviId({ collegeId: input.collegeId, userId: String(user._id), juviId: input.juviId });

  const quiet = normalizeJuviConfig(college.juvi).quietHoursDefault;
  const account = await JuviAccount.create({
    collegeId: input.collegeId,
    personId: input.personId,
    userId: user._id,
    kind: input.kind,
    studentId: input.kind === 'student' ? row.entityId : undefined,
    facultyId: input.kind === 'faculty' ? row.entityId : undefined,
    staffId: input.kind === 'staff' ? row.entityId : undefined,
    status: 'onboarding',
    settings: { quietHours: quiet },
    transitions: [{ from: null, to: 'onboarding', source: input.source, by: input.performedBy, at: new Date() }],
    provisionedBy: input.performedBy,
  });

  let credentialId: string | undefined;
  if (temporaryPassword) {
    credentialId = await storeCredential({
      collegeId: input.collegeId,
      accountId: String(account._id),
      runId: input.runId ?? null,
      source: input.source === 'bulk' ? 'bulk' : input.source === 'workflow' ? 'workflow' : 'admin',
      identifier: row.identifier,
      displayName: person.name,
      sectionId: row.sectionId ? String(row.sectionId) : undefined,
      batchId: row.batchId ? String(row.batchId) : undefined,
      departmentId: row.departmentId ? String(row.departmentId) : undefined,
      plaintext: temporaryPassword,
    });
  }

  await createAuditLog({
    collegeId: input.collegeId,
    entityType: 'JuviAccount',
    entityId: String(account._id),
    entityName: person.name,
    action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: 'onboarding' }],
    performedBy: input.performedBy,
    studentId: input.kind === 'student' ? String(row.entityId) : undefined,
  });

  return { account, created: true, userCreated, credentialId };
}

export async function transitionAccount(account: IJuviAccount, to: AccountStatus, source: TransitionSource, by: string): Promise<IJuviAccount> {
  const from = account.status;
  if (from === to) return account;
  account.status = to;
  account.transitions.push({ from, to, source, by, at: new Date() });
  await account.save();
  await createAuditLog({
    collegeId: String(account.collegeId),
    entityType: 'JuviAccount',
    entityId: String(account._id),
    entityName: `${account.kind} account`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: from, newValue: to }],
    performedBy: by,
    studentId: account.studentId ? String(account.studentId) : undefined,
  });
  if (to === 'active') {
    // Notices spec §6.6: rows snapshotted while the person was Not on Juvi now reach them.
    try {
      await onAccountActivated(String(account.collegeId), String(account._id), String(account.personId));
    } catch (err) {
      console.error('[juvi-app] notice back-fill on activation failed', String(account._id), err);
    }
  }
  return account;
}

export async function deactivateAccount(collegeId: string, accountId: string, source: TransitionSource, performedBy: string): Promise<IJuviAccount> {
  const account = await JuviAccount.findOne({ _id: accountId, collegeId });
  if (!account) throw notFound('Account');
  await transitionAccount(account, 'deactivated', source, performedBy);
  await User.updateOne({ _id: account.userId, collegeId }, { $set: { isActive: false } });
  await revokeOtherSessions(String(account._id), null, 'deactivated');
  await ChannelMembership.deleteMany({ collegeId, accountId: account._id });
  return account;
}

/** Convenience for hooks: provision only when the college has Juvi switched on. */
export async function provisionIfEnabled(input: ProvisionPersonInput): Promise<ProvisionPersonResult | null> {
  const cfg = await getJuviConfig(input.collegeId);
  if (!cfg?.enabled) return null;
  return provisionPerson(input);
}
