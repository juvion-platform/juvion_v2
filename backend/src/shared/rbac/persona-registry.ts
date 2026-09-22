/**
 * 010 — Persona lookup for the RBAC engine.
 *
 * `loadPersonas(collegeId)` returns the college's own rows when it has any,
 * otherwise the system rows, otherwise (empty DB, e.g. unit tests or a dev
 * DB that predates the seed) the code catalog. Cached in Redis 5 minutes.
 *
 * `personaAncestry(collegeId, code)` walks `parentCode` to the root and is
 * what the engine matches policy `personaType` against — explicit links,
 * not string prefixes.
 */
import mongoose from 'mongoose';
import redis from '../../config/redis';
import { Persona } from '../../models/platform/Persona';
import { ALL_PERSONAS } from './personas';

const TTL = 300;

export interface PersonaRow {
  code: string;
  label: string;
  family: string;
  parentCode?: string | null;
  primaryModule: string;
  defaultRole: string;
  tier: number;
  dashboardWidgets?: string[];
  isActive: boolean;
}

const key = (collegeId?: string) => `rbac:personas:${collegeId || 'global'}`;

/** The user's distinct persona codes: primary first, then the rest. */
export function personaCodesOf(user: { personaType?: string; personas?: string[] }): string[] {
  return [...new Set([user.personaType, ...(user.personas ?? [])].filter((c): c is string => !!c))];
}

function catalogRows(): PersonaRow[] {
  return ALL_PERSONAS.map((p) => ({
    code: p.code, label: p.label, family: p.family,
    parentCode: p.parentCode && p.parentCode !== p.code ? p.parentCode : null,
    primaryModule: p.primaryModule, defaultRole: p.defaultRole, tier: p.tier, isActive: true,
  }));
}

export async function loadPersonas(collegeId?: string): Promise<PersonaRow[]> {
  // No DB session (unit tests, offline workers): the code catalog is the truth.
  if (mongoose.connection.readyState !== 1) return catalogRows();
  try {
    const cached = await redis.get(key(collegeId));
    if (cached) return JSON.parse(cached) as PersonaRow[];
  } catch { /* cache miss */ }

  let rows: PersonaRow[] = [];
  try {
    const own = collegeId ? await Persona.find({ collegeId, isActive: true }).lean() : [];
    const docs = own.length > 0 ? own : await Persona.find({ collegeId: null, isActive: true }).lean();
    rows = docs.map((d) => ({
      code: d.code, label: d.label, family: d.family, parentCode: d.parentCode ?? null,
      primaryModule: d.primaryModule, defaultRole: d.defaultRole, tier: d.tier,
      dashboardWidgets: d.dashboardWidgets, isActive: d.isActive,
    }));
  } catch { /* fall through to the code catalog */ }

  if (rows.length === 0) rows = catalogRows();

  try { await redis.set(key(collegeId), JSON.stringify(rows), 'EX', TTL); } catch { /* non-fatal */ }
  return rows;
}

export async function invalidatePersonas(collegeId?: string): Promise<void> {
  try { await redis.del(key(collegeId)); } catch { /* non-fatal */ }
}

/** `[code, parent, grandparent, …]` — always contains `code` itself, even when unknown. */
export function ancestryFrom(rows: PersonaRow[], code: string): string[] {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const out: string[] = [];
  let cur: string | null | undefined = code;
  while (cur && !out.includes(cur)) {
    out.push(cur);
    cur = byCode.get(cur)?.parentCode;
  }
  return out;
}

export async function personaAncestry(collegeId: string | undefined, code: string): Promise<string[]> {
  return ancestryFrom(await loadPersonas(collegeId), code);
}
