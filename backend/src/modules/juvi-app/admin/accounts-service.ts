import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { JuviAccount, AccountKind, AccountStatus } from '../../../models/juvi/JuviAccount';
import { JuviProvisionedCredential } from '../../../models/juvi/JuviProvisionedCredential';
import { User } from '../../../models/User';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { AppError } from '../../../middleware/errorHandler';
import { createAuditLog } from '../../../shared/audit';
import { PaginatedResult } from '../../../shared/types';
import { generateTemporaryPassword } from '../accounts/temp-password';
import { storeCredential, revealLatestForAccount } from '../accounts/credential-store';
import { revokeOtherSessions } from '../accounts/session-service';

export interface AccountRow {
  id: string; kind: AccountKind; status: AccountStatus; name: string; identifier: string; email: string;
  onboardingComplete: boolean; lastSeenAt: string | null; provisionedAt: string;
  hasLiveCredential: boolean; credentialExpiresAt: string | null;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listAccounts(
  collegeId: string, q: { kind?: AccountKind; status?: AccountStatus; q?: string; page: number; limit: number },
): Promise<PaginatedResult<AccountRow>> {
  const filter: Record<string, unknown> = { collegeId };
  if (q.kind) filter.kind = q.kind;
  if (q.status) filter.status = q.status;
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    const [persons, students, faculty, staff] = await Promise.all([
      Person.find({ collegeId, name: rx }).select('_id').lean(),
      Student.find({ collegeId, rollNumber: rx }).select('_id').lean(),
      Faculty.find({ collegeId, employeeCode: rx }).select('_id').lean(),
      Staff.find({ collegeId, employeeCode: rx }).select('_id').lean(),
    ]);
    filter.$or = [
      { personId: { $in: persons.map((p) => p._id) } }, { studentId: { $in: students.map((s) => s._id) } },
      { facultyId: { $in: faculty.map((f) => f._id) } }, { staffId: { $in: staff.map((s) => s._id) } },
    ];
  }

  const total = await JuviAccount.countDocuments(filter);
  const accounts = await JuviAccount.find(filter).sort({ provisionedAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean();
  const ids = accounts.map((a) => a._id);
  const [persons, users, students, faculty, staff, creds] = await Promise.all([
    Person.find({ collegeId, _id: { $in: accounts.map((a) => a.personId) } }).select('name').lean(),
    User.find({ collegeId, _id: { $in: accounts.map((a) => a.userId) } }).select('email').lean(),
    Student.find({ collegeId, _id: { $in: accounts.map((a) => a.studentId).filter(Boolean) } }).select('rollNumber').lean(),
    Faculty.find({ collegeId, _id: { $in: accounts.map((a) => a.facultyId).filter(Boolean) } }).select('employeeCode').lean(),
    Staff.find({ collegeId, _id: { $in: accounts.map((a) => a.staffId).filter(Boolean) } }).select('employeeCode').lean(),
    JuviProvisionedCredential.find({ collegeId, accountId: { $in: ids }, expiresAt: { $gt: new Date() } }).select('accountId expiresAt').lean(),
  ]);
  const by = <T extends { _id: Types.ObjectId }>(rows: T[]) => new Map(rows.map((r) => [String(r._id), r]));
  const P = by(persons); const U = by(users); const S = by(students); const F = by(faculty); const ST = by(staff);
  const credBy = new Map<string, Date>();
  for (const c of creds) { const k = String(c.accountId); if (!credBy.has(k) || credBy.get(k)! < c.expiresAt) credBy.set(k, c.expiresAt); }

  const items: AccountRow[] = accounts.map((a) => ({
    id: String(a._id), kind: a.kind, status: a.status,
    name: P.get(String(a.personId))?.name ?? '',
    identifier: a.studentId ? S.get(String(a.studentId))?.rollNumber ?? '' : a.facultyId ? F.get(String(a.facultyId))?.employeeCode ?? '' : a.staffId ? ST.get(String(a.staffId))?.employeeCode ?? '' : '',
    email: U.get(String(a.userId))?.email ?? '',
    onboardingComplete: Boolean(a.onboardingCompletedAt),
    lastSeenAt: a.lastSeenAt ? a.lastSeenAt.toISOString() : null,
    provisionedAt: a.provisionedAt.toISOString(),
    hasLiveCredential: credBy.has(String(a._id)),
    credentialExpiresAt: credBy.get(String(a._id))?.toISOString() ?? null,
  }));
  return { items, total, page: q.page, pages: Math.max(1, Math.ceil(total / q.limit)) };
}

async function identifierFor(collegeId: string, account: { kind: AccountKind; studentId?: Types.ObjectId; facultyId?: Types.ObjectId; staffId?: Types.ObjectId; userId: Types.ObjectId }): Promise<string> {
  if (account.studentId) return (await Student.findOne({ _id: account.studentId, collegeId }).select('rollNumber').lean())?.rollNumber ?? '';
  if (account.facultyId) return (await Faculty.findOne({ _id: account.facultyId, collegeId }).select('employeeCode').lean())?.employeeCode ?? '';
  if (account.staffId) return (await Staff.findOne({ _id: account.staffId, collegeId }).select('employeeCode').lean())?.employeeCode ?? '';
  return (await User.findOne({ _id: account.userId, collegeId }).select('email').lean())?.email ?? '';
}

export async function resetPassword(collegeId: string, accountId: string, performedBy: string): Promise<{ credentialId: string; expiresAt: Date }> {
  const account = await JuviAccount.findOne({ _id: accountId, collegeId }).lean();
  if (!account) throw new AppError(404, 'Account not found');
  if (account.status === 'deactivated') throw new AppError(409, 'Account is deactivated');
  const person = await Person.findOne({ _id: account.personId, collegeId }).select('name').lean();
  const temporaryPassword = generateTemporaryPassword();
  await User.updateOne({ _id: account.userId, collegeId }, { $set: { password: await bcrypt.hash(temporaryPassword, 10), mustChangePassword: true, passwordChangedAt: new Date() } });
  await revokeOtherSessions(String(account._id), null, 'admin');
  const credentialId = await storeCredential({
    collegeId, accountId: String(account._id), runId: null, source: 'admin',
    identifier: await identifierFor(collegeId, account), displayName: person?.name ?? '', plaintext: temporaryPassword,
  });
  await createAuditLog({
    collegeId, entityType: 'JuviAccount', entityId: String(account._id), entityName: person?.name ?? 'account', action: 'update',
    changes: [{ field: 'password', displayName: 'Password reset', oldValue: null, newValue: 'temporary' }], performedBy,
    studentId: account.studentId ? String(account.studentId) : undefined,
  });
  const cred = await JuviProvisionedCredential.findOne({ _id: credentialId, collegeId }).select('expiresAt').lean();
  return { credentialId, expiresAt: cred!.expiresAt };
}

export async function revealCredential(collegeId: string, accountId: string, performedBy: string): Promise<{ identifier: string; password: string; expiresAt: Date }> {
  const account = await JuviAccount.findOne({ _id: accountId, collegeId }).lean();
  if (!account) throw new AppError(404, 'Account not found');
  const latest = await revealLatestForAccount(collegeId, String(account._id));
  if (!latest) throw new AppError(410, 'No live temporary credential. Reset the password to issue a new one.');
  const person = await Person.findOne({ _id: account.personId, collegeId }).select('name').lean();
  await createAuditLog({
    collegeId, entityType: 'JuviAccount', entityId: String(account._id), entityName: person?.name ?? 'account', action: 'update',
    changes: [{ field: 'temporaryCredential', displayName: 'Temporary credential revealed', oldValue: null, newValue: 'revealed' }], performedBy,
    studentId: account.studentId ? String(account.studentId) : undefined,
  });
  return { identifier: await identifierFor(collegeId, account), password: latest.password, expiresAt: latest.expiresAt };
}
