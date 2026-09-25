import redis from '../../../config/redis';
import { Types } from 'mongoose';
import { College, ICollege, IJuviConfig } from '../../../models/College';

const CACHE_TTL_SECONDS = 60;
const key = (collegeId: string) => `juvi:cfg:${collegeId}`;

export interface JuviConfigView extends IJuviConfig {
  collegeId: string;
  name: string;
  code: string;
  logo?: string;
  collegeStatus: string;
}

/** The lean projection both readers select: `name code logo status juvi`. */
type CollegeConfigLean = Pick<ICollege, 'name' | 'code' | 'logo' | 'status'> & { _id: Types.ObjectId; juvi?: Partial<IJuviConfig> };

/** Fills every IJuviConfig default so lean reads of pre-Juvi or partially-written Colleges are safe. */
export function normalizeJuviConfig(raw: Partial<IJuviConfig> | undefined): IJuviConfig {
  const j: Partial<IJuviConfig> = raw ?? {};
  return {
    enabled: Boolean(j.enabled),
    paused: Boolean(j.paused),
    pausedMessage: j.pausedMessage,
    accentColor: j.accentColor,
    supportContact: j.supportContact,
    quietHoursDefault: j.quietHoursDefault ?? { start: '22:00', end: '07:00' },
    minAppVersion: j.minAppVersion,
    timezone: j.timezone ?? 'Asia/Kolkata',
    featureFlags: { languageRoadmap: Boolean(j.featureFlags?.languageRoadmap) },
  };
}

function toView(doc: CollegeConfigLean): JuviConfigView {
  return {
    collegeId: String(doc._id),
    name: doc.name,
    code: doc.code,
    logo: doc.logo,
    collegeStatus: doc.status,
    ...normalizeJuviConfig(doc.juvi),
  };
}

export async function getJuviConfig(collegeId: string): Promise<JuviConfigView | null> {
  try {
    const cached = await redis.get(key(collegeId));
    if (cached) return JSON.parse(cached) as JuviConfigView;
  } catch { /* Redis down: fall through to Mongo */ }

  const doc = await College.findById(collegeId).select('name code logo status juvi').lean<CollegeConfigLean>();
  if (!doc) return null;
  const view = toView(doc);
  try { await redis.set(key(collegeId), JSON.stringify(view), 'EX', CACHE_TTL_SECONDS); } catch { /* non-fatal */ }
  return view;
}

export async function invalidateJuviConfig(collegeId: string): Promise<void> {
  try { await redis.del(key(collegeId)); } catch { /* non-fatal */ }
}

export async function isJuviEnabled(collegeId: string): Promise<boolean> {
  const cfg = await getJuviConfig(collegeId);
  return Boolean(cfg?.enabled);
}

/** Public S01 lookup. Unknown, inactive and Juvi-disabled colleges all return null. */
export async function lookupInstitutionByCode(code: string): Promise<JuviConfigView | null> {
  const doc = await College.findOne({ code: code.trim().toUpperCase() }).select('name code logo status juvi').lean<CollegeConfigLean>();
  if (!doc) return null;
  const view = toView(doc);
  if (view.collegeStatus !== 'active' || !view.enabled) return null;
  return view;
}

/** True when `current` is strictly below `minimum`. Non-numeric input never blocks. */
export function isVersionBelow(current: string, minimum: string): boolean {
  const parse = (v: string) => v.split('.').map((p) => Number.parseInt(p, 10));
  const a = parse(current); const b = parse(minimum);
  if (a.some(Number.isNaN) || b.some(Number.isNaN) || a.length === 0 || b.length === 0) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0; const y = b[i] ?? 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}
