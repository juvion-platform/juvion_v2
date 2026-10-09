/**
 * seed-e2e-users — idempotent fixture for the Playwright E2E suite.
 * Spec: .captain/specs/playwright-e2e/spec.md §AC-2
 *
 * Creates three dedicated users that the Playwright tests log in as:
 *   - e2e_super@juvion.test       (super_admin, no collegeId)
 *   - e2e_principal@juvion.test   (principal, collegeId = DEV_COLLEGE_ID)
 *   - e2e_registrar@juvion.test   (staff / ST-REG, collegeId = DEV_COLLEGE_ID)
 *
 * The CLI also seeds the Juvi notices audience (seedE2ENoticeAudience): two
 * departments, one faculty member in each, and e2e_hod@juvion.test heading
 * the first.
 *
 * All three share a known password: E2ETestPassword!
 *
 * The script is safe to re-run. It upserts by email so:
 *   - First run: creates both rows.
 *   - Subsequent runs: refreshes the canonical fields (name, role,
 *     personaType, password hash) without creating duplicates.
 *   - Partial state: missing rows are created; existing rows are
 *     normalised back to the canonical shape.
 *
 * Policy seeding: this script also runs `seedPolicies()` from
 * shared/seed/policies so the RBAC default policies are upserted into
 * the Policy collection. Without them, `authorize()` 403s every
 * authenticated request and the e2e suite fails on post-login fetches.
 *
 * Called from:
 *   - Local dev: `npm run seed:e2e-users -w backend`
 *   - CI:        the .github/workflows/e2e.yml workflow runs this
 *                before launching Playwright.
 *   - Playwright global-setup (e2e/tests/global-setup.ts): shells out to
 *                the npm script above; it does not import this module.
 *
 * `seedE2EUsers()` also upserts the E2E College row and the current academic
 * year, so importing callers (the unit test) and the CLI see the same state.
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import { User } from '../models/User';
import { College } from '../models/College';
import { AcademicYear } from '../models/academic-structure/AcademicYear';
import { Department } from '../models/academic-structure/Department';
import { Person } from '../models/people/Person';
import { Faculty } from '../models/people/Faculty';
import { seedPolicies } from '../shared/seed/policies';
import { seedPersonas } from '../shared/seed/personas';

dotenv.config();

export const E2E_TEST_PASSWORD = 'E2ETestPassword!';

const E2E_COLLEGE_ID = process.env.DEV_COLLEGE_ID || '000000000000000000000001';
const E2E_ACADEMIC_YEAR_CODE = 'E2E-AY';

/**
 * A second college that exists only to give the theming acceptance test a
 * deterministic accent.
 *
 * Deliberately NOT the E2E College: `e2e/tests/juvi-admin.spec.ts` saves a
 * *different* accent (`#0B5FA5`) onto that one, and this suite runs
 * `fullyParallel` outside CI, so a theming assertion pinned to the shared
 * college would be order-dependent in CI and a genuine race locally.
 */
export const E2E_THEME_COLLEGE_ID = '000000000000000000000002';
export const E2E_THEME_ACCENT = '#7A1FA2';

/**
 * Upserts the theming college. Idempotent.
 *
 * `$set` rather than `$setOnInsert` for the row: the acceptance test's assertion
 * depends on this accent, so a re-run must normalise it back even if something
 * else has since changed it. `$set` on the whole `juvi` subdocument is deliberate
 * for the same reason — it cannot leave a stale sibling key behind — even though it
 * resets `juvi.enabled` to its default. This college exists only for this test.
 */
export async function seedE2EThemeCollege(): Promise<void> {
  await College.updateOne(
    { _id: E2E_THEME_COLLEGE_ID },
    {
      $set: {
        name: 'E2E Theming College',
        code: 'E2E-THEME',
        address: { line1: '2 Test Road', city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
        contactEmail: 'e2e-theme@juvion.test',
        contactPhone: '9000000200',
        subscription: { plan: 'basic', status: 'active' },
        status: 'active',
        juvi: { accentColor: E2E_THEME_ACCENT },
      },
    },
    { upsert: true },
  );
}

/** The Playwright stack needs a College row for the e2e college id; settings and Juvi read it. */
async function seedE2ECollege(collegeId: string): Promise<void> {
  await College.updateOne(
    { _id: collegeId },
    {
      $setOnInsert: {
        _id: collegeId, name: 'E2E College', code: 'E2E',
        address: { line1: '1 Test Road', city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
        contactEmail: 'e2e@juvion.test', contactPhone: '9000000000',
        subscription: { plan: 'premium', status: 'active' }, status: 'active',
      },
    },
    { upsert: true },
  );
}

/**
 * The e2e college needs exactly ONE current academic year, or student import
 * cannot fee-pin anyone: the matcher requires an `academicYearId`, and the
 * import resolver refuses a college with zero or ambiguous `isCurrent` years.
 * Idempotent — normalises any other current year off first, then upserts ours.
 */
export async function seedE2EAcademicYear(): Promise<void> {
  const collegeId = new mongoose.Types.ObjectId(E2E_COLLEGE_ID);
  await AcademicYear.updateMany(
    { collegeId, isCurrent: true, code: { $ne: E2E_ACADEMIC_YEAR_CODE } },
    { $set: { isCurrent: false } },
  );
  await AcademicYear.updateOne(
    { collegeId, code: E2E_ACADEMIC_YEAR_CODE },
    {
      $set: {
        collegeId,
        code: E2E_ACADEMIC_YEAR_CODE,
        label: 'E2E Academic Year',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2026-05-31'),
        isCurrent: true,
        status: 'active',
      },
    },
    { upsert: true },
  );
}

export const E2E_HOD_EMAIL = 'e2e_hod@juvion.test';

/**
 * The Juvi notices e2e audience (e2e/tests/juvi-notices.spec.ts). The HOD heads
 * the first department; the second is the one their scope must refuse. Codes
 * are E2E-prefixed so they never collide with a dev seed in the same college.
 */
export const E2E_NOTICE_DEPARTMENTS = [
  { code: 'E2E-CSE', name: 'E2E Computer Science', facultyCode: 'E2E-F1', person: { name: 'E2E HOD Rao', phone: '9000000101', email: E2E_HOD_EMAIL } },
  { code: 'E2E-ECE', name: 'E2E Electronics', facultyCode: 'E2E-F2', person: { name: 'E2E Faculty Iyer', phone: '9000000102', email: 'e2e_faculty_ece@juvion.test' } },
] as const;

/**
 * Two departments with one active faculty member each, and an `hod` login
 * (persona F-HOD) linked to the first faculty member, who heads that
 * department through Department.hodId. That is exactly what
 * resolvePublisherScope reads, so the HOD gets a real department scope and
 * the Registrar a real one-person audience. Idempotent: everything upserts
 * on a natural key.
 */
export async function seedE2ENoticeAudience(passwordHash: string): Promise<void> {
  const collegeId = new mongoose.Types.ObjectId(E2E_COLLEGE_ID);
  let hodPersonId: mongoose.Types.ObjectId | undefined;
  for (const [i, d] of E2E_NOTICE_DEPARTMENTS.entries()) {
    const dept = (await Department.findOneAndUpdate({ collegeId, code: d.code }, { $set: { name: d.name, isActive: true } }, { upsert: true, new: true }))!;
    const person = (await Person.findOneAndUpdate({ collegeId, email: d.person.email }, { $set: { name: d.person.name, phone: d.person.phone } }, { upsert: true, new: true }))!;
    const faculty = (await Faculty.findOneAndUpdate(
      { collegeId, employeeCode: d.facultyCode },
      { $set: { personId: person._id, designation: 'Professor', departmentId: dept._id, status: 'active' } },
      { upsert: true, new: true },
    ))!;
    if (i === 0) {
      await Department.updateOne({ _id: dept._id }, { $set: { hodId: faculty._id } });
      hodPersonId = person._id as mongoose.Types.ObjectId;
    }
  }
  await User.updateOne(
    { collegeId, email: E2E_HOD_EMAIL },
    {
      $set: {
        email: E2E_HOD_EMAIL, name: 'E2E HOD Rao', role: 'hod', personaType: 'F-HOD', personas: ['F-HOD'],
        password: passwordHash, isActive: true, collegeId, personId: hodPersonId,
      },
    },
    { upsert: true },
  );
}

export interface E2EUserDefinition {
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'staff';
  personaType: string;
  /** Empty string means "no collegeId" — the super_admin case. */
  collegeId?: string;
}

/**
 * Canonical definitions. Anyone editing this list MUST update the
 * Playwright spec at .captain/specs/playwright-e2e/spec.md §AC-2 and
 * the fixture at admin-portal/tests/e2e/utils/test-users.ts in the
 * same change — they drift silently otherwise.
 */
export const E2E_USER_DEFINITIONS: E2EUserDefinition[] = [
  {
    email: 'e2e_super@juvion.test',
    name: 'E2E Super Admin',
    role: 'super_admin',
    personaType: 'L-PRIN',
    // No collegeId — super_admin is cross-college.
  },
  {
    // Email name kept as `e2e_principal` (semantic: college-level
    // admin from the test perspective). The DB role is 'admin' to
    // match the canonical RBAC posture for college operators — the
    // existing JIT seed uses role='admin' for the same reason.
    // Phase A tests still refer to this user as "principal" — that's
    // the test-user identity, not the DB role.
    email: 'e2e_principal@juvion.test',
    name: 'E2E Principal',
    role: 'admin',
    personaType: 'L-PRIN',
    collegeId: process.env.DEV_COLLEGE_ID || '000000000000000000000001',
  },
  {
    // The Registrar. DEFAULT_POLICIES grants staff/ST-REG `people: *`
    // (shared/rbac/defaults.ts) and NOT `platform: *`, which is exactly the
    // persona the student-import facade exists for: full authority over
    // student records, no access to /platform/bulk-imports. Any Playwright
    // test that claims to prove the people-gated import surface works must
    // log in as this user — `e2e_principal` is role 'admin' and holds the
    // `*:*` wildcard, so it can never distinguish a working gate from an
    // absent one.
    email: 'e2e_registrar@juvion.test',
    name: 'E2E Registrar',
    role: 'staff',
    personaType: 'ST-REG',
    collegeId: process.env.DEV_COLLEGE_ID || '000000000000000000000001',
  },
];

export interface SeedResult {
  created: number;
  updated: number;
  total: number;
}

/**
 * Upserts the E2E users. Idempotent.
 *
 * Returns counts so callers (the CI step, the test) can verify what
 * happened. `created` = rows that didn't exist before this call;
 * `updated` = rows that existed and were refreshed.
 */
export async function seedE2EUsers(): Promise<SeedResult> {
  // Settings and Juvi read the College row; seed it first so every entry point agrees.
  await seedE2ECollege(E2E_COLLEGE_ID);
  const passwordHash = await bcrypt.hash(E2E_TEST_PASSWORD, 10);

  let created = 0;
  let updated = 0;

  for (const def of E2E_USER_DEFINITIONS) {
    // findOneAndUpdate with upsert is the idempotent path. We need to
    // know whether the row pre-existed to count create-vs-update, so
    // pre-check + write in two steps (cheap on a 3-row script).
    const existing = await User.findOne({ email: def.email }).lean();

    const updateDoc: Record<string, unknown> = {
      email: def.email,
      name: def.name,
      role: def.role,
      personaType: def.personaType,
      password: passwordHash,
      isActive: true,
    };
    // The User model uses a partial unique index on collegeId — present
    // for college-scoped users, ABSENT for super_admin. Use $unset to
    // make sure a previously college-scoped row becomes truly absent.
    const writeOp: Record<string, unknown> = { $set: updateDoc };
    if (def.collegeId) {
      updateDoc.collegeId = new mongoose.Types.ObjectId(def.collegeId);
    } else {
      (writeOp as { $unset?: Record<string, 1> }).$unset = { collegeId: 1 };
    }

    await User.updateOne({ email: def.email }, writeOp, { upsert: true });

    if (existing) updated += 1;
    else created += 1;
  }

  // Fee-pinning on student import needs one current academic year for the
  // e2e college; seed it alongside the users so every caller of this
  // function gets it.
  await seedE2EAcademicYear();

  return { created, updated, total: created + updated };
}

// ─── CLI entrypoint ───────────────────────────────────────────────

async function main() {
  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    'mongodb://localhost:27017/juvion_v2';
  // eslint-disable-next-line no-console
  console.log(`[seed-e2e-users] connecting to ${mongoUri}`);
  await mongoose.connect(mongoUri);
  try {
    const userResult = await seedE2EUsers();
    // The Juvi notices spec's audience and HOD login (kept out of seedE2EUsers, whose callers count three users).
    await seedE2ENoticeAudience(await bcrypt.hash(E2E_TEST_PASSWORD, 10));
    // The theming acceptance test's fixture. Kept out of `seedE2EUsers` for the same
    // reason the notices audience is: that function's callers count three users.
    await seedE2EThemeCollege();
    // RBAC default policies are required for `authorize()` to grant access.
    // Without them every authenticated request 403s and the e2e suite fails
    // on the post-login fetches (admissions, governance, platform, etc.).
    const policyResult = await seedPolicies({ createdBy: 'seed-e2e' });
    await seedPersonas({ createdBy: 'seed-e2e' });
    // eslint-disable-next-line no-console
    console.log(
      `[seed-e2e-users] done · users created=${userResult.created} updated=${userResult.updated} total=${userResult.total} · policies attempted=${policyResult.attempted} created=${policyResult.created} updated=${policyResult.updated}`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

// Only run main() when invoked directly (not when imported by tests
// or by Playwright global-setup).
if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed-e2e-users] failed:', err);
    process.exit(1);
  });
}
