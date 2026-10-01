import bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import { Types } from 'mongoose';
import { Policy } from '../../models/platform/Policy';
import { User } from '../../models/User';
import { DEFAULT_POLICIES } from '../../shared/rbac/defaults';
import { seedPolicies, snapshotPoliciesForCollege, policyKey } from '../../shared/seed/policies';
import { seedPersonas, snapshotPersonasForCollege } from '../../shared/seed/personas';

/**
 * Bring the database's roles in line with the code.
 *
 * `seedPolicies` only ever upserts, so a rule deleted from DEFAULT_POLICIES
 * (the staff "read everything" fallback, for one) lives on in any database
 * seeded before the deletion — and the college snapshot copies it straight
 * back. Prune those system rows first, then refresh the college's copy.
 */
export async function resyncRbac(collegeId: string, log: (m: string) => void): Promise<void> {
  const wanted = new Set(DEFAULT_POLICIES.map(policyKey));
  const system = await Policy.find({ collegeId: null }).select({ role: 1, personaType: 1, module: 1, action: 1 }).lean();
  const stale = system.filter((p) => !wanted.has(policyKey(p)));
  if (stale.length) await Policy.deleteMany({ _id: { $in: stale.map((p) => p._id) } });
  const seeded = await seedPolicies({ createdBy: 'seed' });
  await snapshotPoliciesForCollege(collegeId, 'snapshot');
  await seedPersonas({ createdBy: 'seed' });
  await snapshotPersonasForCollege(collegeId, 'seed');
  log(`roles: ${stale.length} outdated rules removed, ${seeded.attempted} current rules applied, college copy refreshed`);
}

export interface DemoLogin {
  email: string;
  password: string;
  name: string;
  role: string;
  personas: string[];
  label: string;
}

/** The demo's logins. Deliberately simple — this is a demo environment. */
export const DEMO_LOGINS: DemoLogin[] = [
  { email: 'admin@jit.edu.in', password: 'admin123', name: 'JIT Admin', role: 'admin', personas: ['L-ADM'], label: 'College admin' },
  { email: 'principal@jit.edu.in', password: 'principal123', name: 'Dr. Srinivas Rao', role: 'principal', personas: ['L-PRIN'], label: 'Principal' },
  { email: 'hod.cse@jit.edu.in', password: 'hod123', name: 'Dr. Ramesh Iyer', role: 'hod', personas: ['F-HOD', 'F-FAC'], label: 'HOD, CSE' },
  { email: 'faculty.cse@jit.edu.in', password: 'faculty123', name: 'Dr. Lakshmi Prasad', role: 'faculty', personas: ['F-FAC'], label: 'Faculty, CSE' },
  { email: 'accounts@jit.edu.in', password: 'finance123', name: 'Padma Latha', role: 'staff', personas: ['ST-ACC'], label: 'Finance / accounts' },
  { email: 'exam@jit.edu.in', password: 'exam123', name: 'Ravi Teja', role: 'staff', personas: ['ST-EXAM'], label: 'Exam controller' },
  { email: 'warden@jit.edu.in', password: 'warden123', name: 'Mahesh Yadav', role: 'staff', personas: ['ST-WARDEN'], label: 'Hostel warden' },
  { email: 'registrar@jit.edu.in', password: 'registrar123', name: 'Registrar', role: 'staff', personas: ['ST-REG'], label: 'Registrar' },
  { email: 'admissions@jit.edu.in', password: 'admissions123', name: 'Admissions Counsellor', role: 'staff', personas: ['ST-ADM-AC'], label: 'Admissions counsellor' },
];

export const SUPER_LOGIN = { email: 'super@juvion.dev', password: 'super123', label: 'Super admin (all colleges)' };

/**
 * Create each demo login, or reset an existing one to the demo password.
 * `people` links a login to its Person (the faculty and warden logins must
 * point at their Faculty/Staff record for department and mentee scope).
 */
export async function ensureLogins(
  collegeId: string,
  people: Record<string, Types.ObjectId>,
  log: (m: string) => void,
): Promise<void> {
  let created = 0, reset = 0;
  for (const l of DEMO_LOGINS) {
    const password = await bcrypt.hash(l.password, 10);
    const fields = {
      password, name: l.name, role: l.role, personaType: l.personas[0], personas: l.personas, isActive: true,
      ...(people[l.email] ? { personId: people[l.email] } : {}),
    };
    const existing = await User.findOne({ collegeId, email: l.email });
    if (existing) {
      // Bumping tokenVersion signs out any session that held the old password.
      await User.updateOne({ _id: existing._id }, { $set: fields, $inc: { tokenVersion: 1 } });
      reset += 1;
    } else {
      await User.create({ collegeId, email: l.email, ...fields });
      created += 1;
    }
  }
  const superPwd = await bcrypt.hash(SUPER_LOGIN.password, 10);
  const sup = await User.findOne({ email: SUPER_LOGIN.email, role: 'super_admin' });
  if (sup) await User.updateOne({ _id: sup._id }, { $set: { password: superPwd, isActive: true }, $inc: { tokenVersion: 1 } });
  else await User.create({ email: SUPER_LOGIN.email, password: superPwd, name: 'Super Admin', role: 'super_admin', personaType: 'L-SADM', personas: ['L-SADM'], isActive: true });
  log(`logins: ${created} created, ${reset} reset to the demo password, super admin ${sup ? 'reset' : 'created'}`);
}

/**
 * Drop the cached roles, per-user scopes and per-day AI answers so the app
 * serves what was just written. A pm2 restart does not clear Redis.
 */
export async function clearCaches(collegeId: string, log: (m: string) => void): Promise<void> {
  const r = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true, enableOfflineQueue: false, connectTimeout: 3000, maxRetriesPerRequest: 1, retryStrategy: () => null,
  });
  r.on('error', () => undefined);
  try {
    await r.connect();
  } catch {
    log('caches: Redis not reachable — cached roles expire on their own within 15 minutes');
    r.disconnect();
    return;
  }
  const patterns = ['rbac:*', 'user:scope:*', 'user:assigned:*', `forecast:${collegeId}:*`, `situations:${collegeId}:*`, `risk:${collegeId}:*`];
  let n = 0;
  for (const match of patterns) {
    let cursor = '0';
    do {
      const [next, keys] = await r.scan(cursor, 'MATCH', match, 'COUNT', 500);
      cursor = next;
      if (keys.length) n += await r.del(...keys);
    } while (cursor !== '0');
  }
  r.disconnect();
  log(`caches: ${n} cached keys cleared`);
}
