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

export async function provisionPerson(input: ProvisionPersonInput): Promise<ProvisionPersonResult> {
  const resetPassword = input.resetPassword ?? true;
  const person = await Person.findOne({ _id: input.personId, collegeId: input.collegeId }).select('name email').lean();
  if (!person) throw notFound('Person');
  const college = await College.findById(input.collegeId).select('code juvi').lean();
  if (!college) throw notFound('College');
  const row = await loadKindRow(input.collegeId, input.personId, input.kind);

  // Existing account: nothing to do (idempotent).
  const existing = await JuviAccount.findOne({ collegeId: input.collegeId, personId: input.personId });
  if (existing) return { account: existing, created: false, userCreated: false };

  let user: IUser | null = await User.findOne({ collegeId: input.collegeId, personId: input.personId });
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
