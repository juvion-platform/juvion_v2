import { z } from 'zod';
import { User } from '../../../models/User';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Programme } from '../../../models/academic-structure/Programme';
import { Branch } from '../../../models/academic-structure/Branch';
import { Batch } from '../../../models/academic-structure/Batch';
import { Section } from '../../../models/academic-structure/Section';
import { Department } from '../../../models/academic-structure/Department';
import { HostelAllocation } from '../../../models/welfare/HostelAllocation';
import { HostelRoom } from '../../../models/welfare/HostelRoom';
import { HostelBlock } from '../../../models/welfare/HostelBlock';
import { JuviAccount } from '../../../models/juvi/JuviAccount';
import { MobileSession } from '../../../models/juvi/MobileSession';
import { isS3Configured, getPresignedUrl } from '../../../shared/s3/s3-client';
import { uploadEntityPhoto, getEntityPhotoUrls } from '../../people/photo-service';
import type { PersonEntityType } from '../../../shared/s3/s3-client';
import { MobileContext } from '../middleware/authenticate-mobile';
import { getJuviConfig } from '../config/institution-config';
import { MobileApiError, notFound } from '../errors';
import { revokeSession, revokeOtherSessions } from './session-service';
import { transitionAccount } from './provisioning-service';
import { accountSummary } from './auth-service';
import { ONBOARDING_STEPS } from './onboarding';
import { MeResponse, settingsPatchSchema, settingsSchema, onboardingStateSchema, deviceRowSchema } from './schemas';

type Settings = z.infer<typeof settingsSchema>;
type OnboardingState = z.infer<typeof onboardingStateSchema>;
type DeviceRow = z.infer<typeof deviceRowSchema>;

const ENTITY_TYPE: Record<MobileContext['kind'], PersonEntityType> = { student: 'students', faculty: 'faculty', staff: 'staff' };
const entityIdOf = (ctx: MobileContext) => ctx.studentId ?? ctx.facultyId ?? ctx.staffId ?? '';

async function photoUrlFor(ctx: MobileContext): Promise<string | null> {
  if (!isS3Configured()) return null;
  try {
    const urls = await getEntityPhotoUrls(ENTITY_TYPE[ctx.kind], ctx.collegeId, entityIdOf(ctx), 'thumb');
    return urls.thumb?.url ?? null;
  } catch { return null; }
}

async function logoUrlFor(logoKey?: string): Promise<string | null> {
  if (!logoKey) return null;
  if (/^https?:\/\//.test(logoKey)) return logoKey;
  if (!isS3Configured()) return null;
  try { return (await getPresignedUrl(logoKey, { expiresIn: 86_400 })).url; } catch { return null; }
}

export async function getMe(ctx: MobileContext): Promise<MeResponse> {
  const [account, user, person, cfg] = await Promise.all([
    JuviAccount.findOne({ _id: ctx.accountId, collegeId: ctx.collegeId }),
    User.findOne({ _id: ctx.userId, collegeId: ctx.collegeId }).select('mustChangePassword role').lean(),
    Person.findOne({ _id: ctx.account.personId, collegeId: ctx.collegeId }).select('name').lean(),
    getJuviConfig(ctx.collegeId),
  ]);
  if (!account || !user || !person || !cfg) throw notFound('Account');

  let student: MeResponse['student'] = null;
  let faculty: MeResponse['faculty'] = null;

  if (account.kind === 'student' && account.studentId) {
    const s = await Student.findOne({ _id: account.studentId, collegeId: ctx.collegeId }).select('rollNumber programmeId branchId batchId studyYearAtAdmission').lean();
    if (s) {
      const [programme, branch, batch, section] = await Promise.all([
        s.programmeId ? Programme.findOne({ _id: s.programmeId, collegeId: ctx.collegeId }).select('name').lean() : null,
        s.branchId ? Branch.findOne({ _id: s.branchId, collegeId: ctx.collegeId }).select('name departmentId').lean() : null,
        s.batchId ? Batch.findOne({ _id: s.batchId, collegeId: ctx.collegeId }).select('name').lean() : null,
        Section.findOne({ collegeId: ctx.collegeId, studentIds: s._id }).select('name').lean(),
      ]);
      const department = branch?.departmentId ? await Department.findOne({ _id: branch.departmentId, collegeId: ctx.collegeId }).select('name').lean() : null;
      const allocation = await HostelAllocation.findOne({ collegeId: ctx.collegeId, studentId: s._id, status: 'active' }).select('roomId').lean();
      const room = allocation ? await HostelRoom.findOne({ _id: allocation.roomId, collegeId: ctx.collegeId }).select('blockId').lean() : null;
      const block = room ? await HostelBlock.findOne({ _id: room.blockId, collegeId: ctx.collegeId }).select('name').lean() : null;
      student = {
        rollNumber: s.rollNumber ?? null,
        programme: programme?.name ?? null,
        branch: branch?.name ?? null,
        batch: batch?.name ?? null,
        section: section?.name ?? null,
        department: department?.name ?? null,
        hostel: block?.name ?? null,
        isLateralEntry: (s.studyYearAtAdmission ?? 1) > 1,
      };
    }
  } else if (account.kind === 'faculty' && account.facultyId) {
    const f = await Faculty.findOne({ _id: account.facultyId, collegeId: ctx.collegeId }).select('employeeCode designation departmentId').lean();
    if (f) {
      const department = f.departmentId ? await Department.findOne({ _id: f.departmentId, collegeId: ctx.collegeId }).select('name').lean() : null;
      const isHod = Boolean(await Department.exists({ collegeId: ctx.collegeId, hodId: f._id }));
      faculty = { employeeCode: f.employeeCode, designation: f.designation, department: department?.name ?? null, isHod };
    }
  }

  return {
    account: accountSummary(account, user),
    person: { name: person.name, firstName: person.name.split(/\s+/)[0] ?? person.name, photoUrl: await photoUrlFor(ctx) },
    student,
    faculty,
    settings: account.settings as Settings,
    institution: {
      name: cfg.name, code: cfg.code, logoUrl: await logoUrlFor(cfg.logo), accentColor: cfg.accentColor ?? null,
      supportContact: cfg.supportContact ?? null, timezone: cfg.timezone,
    },
    asOf: new Date().toISOString(),
  };
}

export async function getSettings(ctx: MobileContext): Promise<Settings> {
  const account = await JuviAccount.findOne({ _id: ctx.accountId, collegeId: ctx.collegeId }).select('settings').lean();
  if (!account) throw notFound('Account');
  return account.settings as Settings;
}

export async function updateSettings(ctx: MobileContext, patch: z.infer<typeof settingsPatchSchema>): Promise<Settings> {
  const set: Record<string, unknown> = {};
  if (patch.quietHours) set['settings.quietHours'] = patch.quietHours;
  if (patch.tiers?.important !== undefined) set['settings.tiers.important'] = patch.tiers.important;
  if (patch.tiers?.routine !== undefined) set['settings.tiers.routine'] = patch.tiers.routine;
  if (patch.language) set['settings.language'] = patch.language;
  const account = await JuviAccount.findOneAndUpdate({ _id: ctx.accountId, collegeId: ctx.collegeId }, { $set: set }, { new: true }).select('settings').lean();
  if (!account) throw notFound('Account');
  return account.settings as Settings;
}

export async function advanceOnboarding(ctx: MobileContext, step: number): Promise<OnboardingState> {
  const account = await JuviAccount.findOne({ _id: ctx.accountId, collegeId: ctx.collegeId });
  if (!account) throw notFound('Account');
  const total = ONBOARDING_STEPS.length;
  const state = () => ({ onboardingStep: account.onboardingStep, onboardingSteps: [...ONBOARDING_STEPS], onboardingComplete: Boolean(account.onboardingCompletedAt) });

  if (account.onboardingCompletedAt && step === total - 1) return state();          // idempotent re-send of the last step
  if (step !== account.onboardingStep) {
    throw new MobileApiError(400, 'VALIDATION_FAILED', 'That step is out of order.', { currentStep: account.onboardingStep });
  }
  account.onboardingStep = step + 1;
  if (account.onboardingStep >= total) {
    account.onboardingCompletedAt = new Date();
    await account.save();
    if (account.status === 'onboarding') await transitionAccount(account, 'active', 'system', 'onboarding');
  } else {
    await account.save();
  }
  return state();
}

export async function listDevices(ctx: MobileContext): Promise<DeviceRow[]> {
  const rows = await MobileSession.find({ collegeId: ctx.collegeId, accountId: ctx.accountId, revokedAt: null }).sort({ lastActiveAt: -1 }).lean();
  return rows.map((r) => ({
    sessionId: String(r._id), deviceName: r.deviceName, platform: r.platform, appVersion: r.appVersion,
    lastActiveAt: r.lastActiveAt.toISOString(), isCurrent: String(r._id) === ctx.sessionId,
  }));
}

export async function revokeDevice(ctx: MobileContext, sessionId: string): Promise<void> {
  const row = await MobileSession.findOne({ _id: sessionId, collegeId: ctx.collegeId, accountId: ctx.accountId, revokedAt: null }).select('_id').lean();
  if (!row) throw notFound('Device');
  await revokeSession(sessionId, 'signed_out_elsewhere');
}

export async function revokeOtherDevices(ctx: MobileContext): Promise<number> {
  return revokeOtherSessions(ctx.accountId, ctx.sessionId, 'signed_out_elsewhere');
}

export async function uploadMyPhoto(ctx: MobileContext, buffer: Buffer, declaredMime?: string): Promise<{ photoUrl: string | null }> {
  await uploadEntityPhoto({ entityType: ENTITY_TYPE[ctx.kind], collegeId: ctx.collegeId, entityId: entityIdOf(ctx), buffer, declaredMime });
  return { photoUrl: await photoUrlFor(ctx) };
}
