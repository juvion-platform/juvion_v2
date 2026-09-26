/**
 * Idempotent seeder for the persona catalog (010).
 *
 * Upserts every entry of `ALL_PERSONAS` as a system row (`collegeId: null`)
 * keyed by `code`. Never deletes: a code removed from the catalog stays in
 * the DB until an operator deactivates it, so users holding it keep working.
 */
import { Persona } from '../../models/platform/Persona';
import { ALL_PERSONAS } from '../rbac/personas';

export interface SeedPersonasResult { attempted: number; created: number; updated: number }

export async function seedPersonas(opts: { createdBy?: string } = {}): Promise<SeedPersonasResult> {
  const createdBy = opts.createdBy ?? 'seed';
  let created = 0;
  let updated = 0;
  for (const p of ALL_PERSONAS) {
    const result = await Persona.updateOne(
      { collegeId: null, code: p.code },
      {
        $set: {
          label: p.label, description: p.description, family: p.family,
          parentCode: p.parentCode && p.parentCode !== p.code ? p.parentCode : null,
          primaryModule: p.primaryModule, defaultRole: p.defaultRole, tier: p.tier,
          permissionsHint: p.permissionsHint,
          dashboardWidgets: p.dashboardWidgets,
          accessibleModules: p.accessibleModules,
        },
        $setOnInsert: { isActive: true, createdBy },
      },
      { upsert: true },
    );
    if (result.upsertedCount && result.upsertedCount > 0) created += 1; else updated += 1;
  }
  return { attempted: ALL_PERSONAS.length, created, updated };
}

/**
 * Copy every active system persona into college-owned rows (skipping codes
 * the college already has). Called at college creation and by the dev seed.
 * The college evaluates against its own rows from then on, so later edits to
 * the system catalog never change a live college silently.
 */
export async function snapshotPersonasForCollege(collegeId: string, createdBy = 'snapshot'): Promise<number> {
  const system = await Persona.find({ collegeId: null, isActive: true }).lean();
  const existing = new Set((await Persona.find({ collegeId }).select('code').lean()).map((p) => p.code));
  let copied = 0;
  for (const p of system) {
    if (existing.has(p.code)) {
      await Persona.updateOne(
        { collegeId, code: p.code },
        { $set: { dashboardWidgets: p.dashboardWidgets, accessibleModules: p.accessibleModules } },
      );
      continue;
    }
    const { _id, createdAt, updatedAt, ...rest } = p as any;
    await Persona.create({ ...rest, collegeId, createdBy });
    copied += 1;
  }
  return copied;
}
