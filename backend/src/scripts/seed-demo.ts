/**
 * seed-demo.ts — build the university demo on this server's database.
 *
 * One command, safe to run more than once:
 *
 *   npm run seed:demo            build / refresh the demo (from the repo root)
 *   npm run seed:demo -- --check report only; writes nothing
 *
 * It uses backend/.env, so it writes to whatever database the running app
 * uses. It only ever ADDS to Juvion Institute of Technology (JIT): it never
 * deletes another college's data and never runs the destructive `seed.ts`.
 *
 * What it changes on existing rows, deliberately:
 *   - AY2026-27 becomes the current academic year
 *   - the demo logins (see the table it prints) are reset to their simple passwords
 *   - roles: rules removed from the code are removed from the database
 *   - the risk board and demo finance history are rebuilt from scratch each run
 */
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { tmpdir } from 'os';
import { join } from 'path';

import redis from '../config/redis';
import { College } from '../models/College';
import { AcademicYear } from '../models/academic-structure/AcademicYear';
import { Student } from '../models/people/Student';
import { Faculty } from '../models/people/Faculty';
import { FeeStructureInstance } from '../models/finance/FeeStructureInstance';
import { CrisisAlert } from '../models/welfare/CrisisAlert';
import { Payment } from '../models/finance/Payment';
import { Inquiry } from '../models/admissions/Inquiry';
import { Policy } from '../models/platform/Policy';
import { DEFAULT_POLICIES } from '../shared/rbac/defaults';
import { policyKey } from '../shared/seed/policies';

import { seedFeeComponentTemplateForCollege } from './seed-fee-component-template';
import { seedFeeQuotasForCollege } from './seed-fee-quotas';
import { seedFeeCategoriesForCollege } from './seed-fee-categories';
import { seedFeeStructureInstancesForCollege } from './seed-fee-structure-instances';
import { runBackfill } from './backfill-fee-pins';
import { seedDemoAi } from './seed-demo-ai';
import { seedAgentFindings, clearAgentFindings } from './seed-agent-findings';
import { DefaulterRecord } from '../models/finance/DefaulterRecord';

import { findOrCreateCollege, ensureFoundations } from './demo-seed/foundations';
import { resyncRbac, ensureLogins, clearCaches, DEMO_LOGINS, SUPER_LOGIN } from './demo-seed/access';
import { ensureStudents } from './demo-seed/students';
import { seedAcademics } from './demo-seed/academics';
import { seedStoryExtras, storyStudents } from './demo-seed/extras';
import { seedBreadth } from './demo-seed/breadth';

const CHECK_ONLY = process.argv.includes('--check');
const t0 = Date.now();
const log = (m: string) => console.log(`  ${m}`);
const step = (m: string) => console.log(`\n▶ ${m}  (${Math.round((Date.now() - t0) / 1000)}s)`);

function dbLabel(uri: string): string {
  try {
    const u = new URL(uri);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return '(unparseable MONGODB_URI)';
  }
}

async function redisReachable(): Promise<boolean> {
  const r = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { lazyConnect: true, enableOfflineQueue: false, connectTimeout: 3000, maxRetriesPerRequest: 1, retryStrategy: () => null });
  r.on('error', () => undefined);
  try { await r.connect(); await r.ping(); return true; } catch { return false; } finally { r.disconnect(); }
}

/** What is on this server now, so the operator sees what the run will build on. */
async function report(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/juvion_v2';
  const aiKey = !!(process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
  const redisOk = await redisReachable();
  console.log('\n══ This server ══');
  log(`database:         ${dbLabel(uri)}`);
  log(`AI key:           ${aiKey ? 'set' : 'MISSING — AI insights will fall back to rules, command bars will not answer'}`);
  log(`command-bar model:${process.env.JUVI_CHAT_MODEL ? ` ${process.env.JUVI_CHAT_MODEL}` : ' default (set JUVI_CHAT_MODEL=gpt-4o for sharper answers)'}`);
  log(`background jobs:  ${process.env.DISABLE_BACKGROUND_JOBS === 'true' ? 'DISABLED — a new inquiry will not get a lead score' : 'on'}`);
  log(`redis:            ${redisOk ? 'reachable' : 'NOT reachable — lead scoring and AI caching will not work'}`);

  const college = await College.findOne({ code: 'JIT' }).lean();
  console.log('\n══ Juvion Institute of Technology ══');
  if (!college) { log('not on this server yet — the build will create it'); return; }
  const cid = college._id;
  const ay = await AcademicYear.findOne({ collegeId: cid, isCurrent: true }).lean();
  const stale = (await Policy.find({ collegeId: null }).select({ role: 1, personaType: 1, module: 1, action: 1 }).lean())
    .filter((p) => !new Set(DEFAULT_POLICIES.map(policyKey)).has(policyKey(p))).length;
  log(`current year:     ${ay?.code ?? 'none'}`);
  log(`students:         ${await Student.countDocuments({ collegeId: cid, status: 'active' })} active (${await Student.countDocuments({ collegeId: cid, rollNumber: /^2[3-6]B01A\d{4}$/ })} of the demo cohort)`);
  log(`faculty:          ${await Faculty.countDocuments({ collegeId: cid })}`);
  log(`fee structures:   ${ay ? await FeeStructureInstance.countDocuments({ collegeId: cid, academicYearId: ay._id, status: 'active' }) : 0} active for the current year`);
  log(`risk board:       ${await CrisisAlert.countDocuments({ collegeId: cid, type: 'compound_risk', status: { $nin: ['resolved', 'false_positive'] } })} open alerts`);
  log(`payments:         ${await Payment.countDocuments({ collegeId: cid })}`);
  log(`inquiries:        ${await Inquiry.countDocuments({ collegeId: cid })}`);
  log(`roles:            ${stale} outdated rule(s) still in the database`);
}

async function build(): Promise<void> {
  step('College');
  const { collegeId, collegeName } = await findOrCreateCollege(log);

  step('Academic structure, faculty and staff');
  const { ctx, people } = await ensureFoundations(collegeId, collegeName, log);

  step('Roles and demo logins');
  await resyncRbac(collegeId, log);
  await ensureLogins(collegeId, people, log);

  step('Fee setup (quotas, categories, fee structures for AY2026-27)');
  await seedFeeComponentTemplateForCollege(collegeId);
  await seedFeeQuotasForCollege(collegeId);
  await seedFeeCategoriesForCollege(collegeId);
  const fsi = await seedFeeStructureInstancesForCollege(collegeId);
  log(`fee structures: ${fsi.inserted} created`);

  step('Students (240) with guardians, sections and hostel');
  ctx.students = await ensureStudents(ctx);
  const pins = await runBackfill({ mode: 'commit', collegeId, csvPath: join(tmpdir(), `demo-fee-pins-${Date.now()}.csv`), progressEvery: 100_000 });
  log(`fee pins: exit ${pins.exitCode}${pins.error ? ` — ${pins.error}` : ''}`);

  step('Risk board, six months of fees, defaulters, admissions funnel');
  // The findings fixtures go first, or last run's defaulters make the story skip students.
  await clearAgentFindings(collegeId);
  await seedDemoAi({ collegeId, confirmCollegeName: collegeName, clearFirst: true, poolPattern: /^2[3-6]B01A\d{4}$/, skipHousing: true });

  step('Finance agent findings');
  // On students outside the risk story, so the two never contradict each other.
  const storyIds = [
    ...(await CrisisAlert.distinct('studentId', { collegeId, type: 'compound_risk' })),
    ...(await DefaulterRecord.distinct('studentId', { collegeId, 'metadata.source': 'demo-ai-v1' })),
  ].map((id) => new mongoose.Types.ObjectId(String(id)));
  const findings = await seedAgentFindings({ collegeId, confirmCollegeName: collegeName, clearFirst: true, excludeStudentIds: storyIds });
  log(`findings: ${JSON.stringify(findings)}`);

  step('Attendance, marks and backlogs behind every signal');
  await seedAcademics(ctx);

  step('Mentors, hostel and counselling records, reminders, lead scores');
  await seedStoryExtras(ctx);

  step('Other modules (placement, HR, campus, library, clubs, compliance…)');
  await seedBreadth(ctx);

  step('Clearing cached roles and AI answers');
  await clearCaches(collegeId, log);

  const story = await storyStudents(collegeId);
  console.log('\n══ Demo logins ══');
  for (const l of DEMO_LOGINS) console.log(`  ${l.label.padEnd(24)} ${l.email.padEnd(26)} ${l.password}`);
  console.log(`  ${SUPER_LOGIN.label.padEnd(24)} ${SUPER_LOGIN.email.padEnd(26)} ${SUPER_LOGIN.password}`);
  console.log('\n══ Student Risk board (open these in the demo) ══');
  for (const s of story.slice(0, 10)) console.log(`  ${s.priority.padEnd(3)} ${String(s.score).padStart(3)}  ${s.name.padEnd(22)} ${s.roll.padEnd(11)} ${s.label}`);
  console.log(`\nDone in ${Math.round((Date.now() - t0) / 1000)}s. On demo morning (after 5:30 am IST), log in as admin and open`);
  console.log('Finance → Dashboard, Welfare → Student Risk, and Admissions once each, so the AI answers are ready.');
}

async function main(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/juvion_v2');
  try {
    await report();
    if (CHECK_ONLY) { console.log('\n--check: nothing was written.'); return; }
    await build();
  } finally {
    await mongoose.disconnect();
    redis.disconnect();
  }
}

main().catch((e) => {
  console.error('\n✖ The demo build stopped:', e instanceof Error ? e.stack : e);
  console.error('It is safe to run the same command again once the cause is fixed.');
  process.exit(1);
});
