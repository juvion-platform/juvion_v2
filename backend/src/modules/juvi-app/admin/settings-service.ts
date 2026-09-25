import { z } from 'zod';
import { College, IJuviConfig } from '../../../models/College';
import { AppError } from '../../../middleware/errorHandler';
import { createAuditLog } from '../../../shared/audit';
import { FieldChange } from '../../../shared/types';
import { seedChannelTemplates } from '../../../shared/seed/channel-templates';
import { getJuviConfig, invalidateJuviConfig, normalizeJuviConfig } from '../config/institution-config';
import { getLastReconcile, ReconcileSummary } from '../spaces/reconcile-service';
import { enqueueReconcile } from '../spaces/reconcile-worker';
import { settingsUpdateSchema } from './schemas';

export interface AdminSettingsView {
  juvi: IJuviConfig;
  college: { name: string; code: string };
  lastReconcile: ReconcileSummary | null;
}

async function view(collegeId: string): Promise<AdminSettingsView> {
  const c = await College.findById(collegeId).select('name code juvi').lean();
  if (!c) throw new AppError(404, 'College not found');
  return { juvi: normalizeJuviConfig(c.juvi), college: { name: c.name, code: c.code }, lastReconcile: await getLastReconcile(collegeId) };
}

/** Guard for anything that provisions or reconciles: Juvi stays inert until an admin enables it. */
export async function assertJuviEnabled(collegeId: string): Promise<void> {
  const cfg = await getJuviConfig(collegeId);
  if (!cfg?.enabled) throw new AppError(409, 'Enable Juvi in Settings before provisioning');
}

/** Reads a dotted path out of a plain object, returning undefined when any step is missing. */
function valueAt(root: unknown, path: string[]): unknown {
  let cur: unknown = root;
  for (const k of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

export async function getSettings(collegeId: string): Promise<AdminSettingsView> {
  return view(collegeId);
}

/** Flattens the patch to dotted `juvi.*` paths so partial updates never clobber siblings. */
function flatten(patch: Record<string, unknown>, prefix = 'juvi'): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && !['supportContact', 'minAppVersion', 'quietHoursDefault'].includes(k)) {
      Object.assign(out, flatten(v as Record<string, unknown>, `${prefix}.${k}`));
    } else {
      out[`${prefix}.${k}`] = v;
    }
  }
  return out;
}

export async function updateSettings(collegeId: string, patch: z.infer<typeof settingsUpdateSchema>, performedBy: string): Promise<AdminSettingsView> {
  const before = await College.findById(collegeId).select('name juvi').lean();
  if (!before) throw new AppError(404, 'College not found');
  const set = flatten(patch as Record<string, unknown>);
  if (Object.keys(set).length === 0) throw new AppError(400, 'Nothing to update');

  await College.updateOne({ _id: collegeId }, { $set: set });
  await invalidateJuviConfig(collegeId);

  const changes: FieldChange[] = Object.entries(set).map(([field, newValue]) => ({
    field, displayName: field.replace('juvi.', 'Juvi '), oldValue: valueAt(before.juvi, field.split('.').slice(1)), newValue,
  }));
  await createAuditLog({ collegeId, entityType: 'College', entityId: collegeId, entityName: before.name, action: 'update', changes, performedBy });

  // First enable: make sure templates exist and kick off the first reconcile.
  if (patch.enabled === true && !before.juvi?.enabled) {
    await seedChannelTemplates(collegeId);
    await enqueueReconcile(collegeId);
  }
  return view(collegeId);
}
