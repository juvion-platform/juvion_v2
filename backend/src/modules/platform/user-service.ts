/**
 * 010 S5 — user provisioning for a college.
 *
 * A user holds one or more personas; `role` is derived from them (highest
 * tier wins) and is never edited directly. Any change to personas, role or
 * active flag bumps the token version so outstanding sessions end on their
 * next request, and clears the cached row scope.
 */
import bcrypt from 'bcryptjs';
import { AppError } from '../../middleware/errorHandler';
import type { FieldChange } from '../../shared/types';
import { User } from '../../models/User';
import { Person } from '../../models/people/Person';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { loadPersonas, ancestryFrom, PersonaRow } from '../../shared/rbac/persona-registry';
import { loadPolicies, filterPolicies, sortPolicies, decide } from '../../shared/rbac/engine';
import { bumpTokenVersion } from '../../shared/rbac/token-version';
import { invalidateUserScope } from '../../shared/rbac/scope-resolver';

const ch = (field: string, oldValue: unknown, newValue: unknown): FieldChange => ({ field, displayName: field, oldValue, newValue });

const ROLE_RANK: Record<string, number> = {
  parent: 0, student: 1, staff: 2, faculty: 3, hod: 4, principal: 5, admin: 6, super_admin: 7,
};

export function deriveRole(personas: string[], rows: PersonaRow[]): string {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  let best = 'staff';
  for (const code of personas) {
    const role = byCode.get(code)?.defaultRole;
    if (role && (ROLE_RANK[role] ?? -1) > (ROLE_RANK[best] ?? -1)) best = role;
  }
  return best;
}

async function resolvePersonaSet(collegeId: string, personas: string[], callerRole: string) {
  const codes = [...new Set(personas.map((c) => c.toUpperCase()))];
  if (codes.length === 0) throw new AppError(400, 'At least one persona is required');
  const rows = await loadPersonas(collegeId);
  const known = new Set(rows.map((r) => r.code));
  const unknown = codes.filter((c) => !known.has(c));
  if (unknown.length) throw new AppError(400, `Unknown persona(s): ${unknown.join(', ')}`);
  const role = deriveRole(codes, rows);
  if (role === 'super_admin' && callerRole !== 'super_admin') {
    throw new AppError(403, 'Only a super admin can grant a super-admin persona');
  }
  return { codes, role };
}

const PUBLIC = '-password';

export async function listUsers(collegeId: string, page: number, limit: number, q: { role?: string; persona?: string; includeInactive?: boolean }) {
  const filter: Record<string, unknown> = { collegeId };
  if (q.role) filter.role = q.role;
  if (q.persona) filter.$or = [{ personas: q.persona.toUpperCase() }, { personaType: q.persona.toUpperCase() }];
  if (!q.includeInactive) filter.isActive = true;
  const result = await paginate(User, filter, page, limit, { name: 1 }, 'personId');
  result.items = result.items.map((u: any) => { const { password: _p, ...rest } = u; return rest; });
  return result;
}

export async function getUser(collegeId: string, id: string) {
  const doc = await User.findOne({ _id: id, collegeId }).select(PUBLIC).populate('personId').lean();
  if (!doc) throw new AppError(404, 'User not found');
  return doc;
}

interface UserInput { email: string; password?: string; name: string; personas: string[]; personId?: string | null; isActive?: boolean }

async function checkPerson(collegeId: string, personId?: string | null) {
  if (!personId) return;
  const p = await Person.findOne({ _id: personId, collegeId }).select('_id').lean();
  if (!p) throw new AppError(400, 'Linked person not found in this college');
}

export async function createUser(collegeId: string, data: UserInput, performedBy: string, callerRole: string) {
  const email = data.email.trim().toLowerCase();
  if (await User.findOne({ email, collegeId }).select('_id').lean()) throw new AppError(409, 'A user with this email already exists');
  if (!data.password) throw new AppError(400, 'Password is required');
  const { codes, role } = await resolvePersonaSet(collegeId, data.personas, callerRole);
  await checkPerson(collegeId, data.personId);
  const doc = await User.create({
    collegeId, email, name: data.name, password: await bcrypt.hash(data.password, 10),
    role, personaType: codes[0], personas: codes, personId: data.personId || undefined,
    isActive: data.isActive ?? true,
  });
  await createAuditLog({ collegeId, entityType: 'User', entityId: String(doc._id), entityName: email, action: 'create', changes: [ch('personas', null, codes)], performedBy });
  return getUser(collegeId, String(doc._id));
}

export async function updateUser(collegeId: string, id: string, data: Partial<UserInput>, performedBy: string, callerRole: string) {
  const user = await User.findOne({ _id: id, collegeId });
  if (!user) throw new AppError(404, 'User not found');
  const changes: FieldChange[] = [];
  let sessionsInvalid = false;

  if (data.personas) {
    const { codes, role } = await resolvePersonaSet(collegeId, data.personas, callerRole);
    if (codes.join() !== user.personas.join() || role !== user.role) {
      changes.push(ch('personas', user.personas, codes));
      user.personas = codes; user.personaType = codes[0]!; user.role = role; sessionsInvalid = true;
    }
  }
  if (data.personId !== undefined) {
    await checkPerson(collegeId, data.personId);
    changes.push(ch('personId', user.personId, data.personId));
    user.personId = (data.personId || undefined) as any; sessionsInvalid = true;
  }
  if (data.isActive !== undefined && data.isActive !== user.isActive) {
    changes.push(ch('isActive', user.isActive, data.isActive));
    user.isActive = data.isActive; sessionsInvalid = true;
  }
  if (data.name && data.name !== user.name) { changes.push(ch('name', user.name, data.name)); user.name = data.name; }
  if (data.email) {
    const email = data.email.trim().toLowerCase();
    if (email !== user.email) {
      if (await User.findOne({ email, collegeId, _id: { $ne: id } }).select('_id').lean()) throw new AppError(409, 'A user with this email already exists');
      changes.push(ch('email', user.email, email)); user.email = email;
    }
  }
  await user.save();
  if (sessionsInvalid) { await bumpTokenVersion(id); await invalidateUserScope(id); }
  if (changes.length) await createAuditLog({ collegeId, entityType: 'User', entityId: id, entityName: user.email, action: 'update', changes, performedBy });
  return getUser(collegeId, id);
}

export async function resetPassword(collegeId: string, id: string, password: string, performedBy: string) {
  const user = await User.findOne({ _id: id, collegeId });
  if (!user) throw new AppError(404, 'User not found');
  user.password = await bcrypt.hash(password, 10);
  await user.save();
  await bumpTokenVersion(id);
  await createAuditLog({ collegeId, entityType: 'User', entityId: id, entityName: user.email, action: 'update', changes: [ch('password', '***', '***')], performedBy });
  return { reset: true };
}

/**
 * "Why can (or can't) this user do X?" — the per-persona winners and the
 * final verdict, for the Users page and for support.
 */
export async function explainAccess(collegeId: string, id: string, module: string, action: string) {
  const user = await User.findOne({ _id: id, collegeId }).select(PUBLIC).lean();
  if (!user) throw new AppError(404, 'User not found');
  const personas = [...new Set([user.personaType, ...(user.personas ?? [])])];
  const [policies, rows] = await Promise.all([loadPolicies(collegeId, user.role), loadPersonas(collegeId)]);
  const perPersona = personas.map((code) => {
    const chain = ancestryFrom(rows, code);
    const matched = sortPolicies(filterPolicies(policies, module, action, chain), chain);
    return { persona: code, chain, winner: matched[0] ?? null, matched };
  });
  const chains = perPersona.map((p) => p.chain);
  const decision = decide(policies, chains, module, action);
  return { user: { id, role: user.role, personas }, module, action, verdict: decision?.effect ?? 'deny', decision, perPersona };
}
