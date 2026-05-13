/**
 * config-service — generic CRUD over `ConfigEntry`, driven by the
 * `config-registry`. Strategic Gap 3 Phase A.
 *
 * One service. One model. Many config types. New types are registry-
 * only changes: no new service code, no new routes, no new front-end.
 *
 * All operations are college-scoped. Validation runs against the
 * registered schema before any write; unknown fields are dropped.
 */

import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { ConfigEntry, SINGLETON_IDENTIFIER, IConfigEntry } from '../../models/platform/ConfigEntry';
import {
  ConfigSchema,
  getRegisteredSchema,
  listRegisteredSchemas,
  validateAgainstSchema,
} from './config-registry';

function mustGetSchema(type: string): ConfigSchema {
  const schema = getRegisteredSchema(type);
  if (!schema) throw new AppError(404, `Unknown config type: ${type}`);
  return schema;
}

// ─── Schema introspection ─────────────────────────────────────────

export function listConfigTypes(): { types: ConfigSchema[] } {
  return { types: listRegisteredSchemas() };
}

export function getConfigSchema(type: string): ConfigSchema {
  return mustGetSchema(type);
}

// ─── Read ─────────────────────────────────────────────────────────

/**
 * For multi: list all entries for the (college, type).
 * For single: return an array with one entry (the singleton). If no
 *   row exists yet, return an empty entry shape filled with registry
 *   defaults so the UI has something to render.
 */
export async function listConfigEntries(collegeId: string, type: string) {
  const schema = mustGetSchema(type);

  const rows = await ConfigEntry.find({ collegeId, configType: type })
    .sort({ identifier: 1 })
    .lean();

  if (schema.cardinality === 'single' && rows.length === 0) {
    return [{
      collegeId,
      configType: type,
      identifier: SINGLETON_IDENTIFIER,
      values: defaultValuesForSchema(schema),
      enabled: true,
      isDefault: true,
    }];
  }

  return rows;
}

export async function getConfigEntry(
  collegeId: string,
  type: string,
  identifier?: string,
) {
  const schema = mustGetSchema(type);
  const id = schema.cardinality === 'single' ? SINGLETON_IDENTIFIER : identifier;
  if (!id) throw new AppError(400, 'identifier required for multi-cardinality config');

  const row = await ConfigEntry.findOne({ collegeId, configType: type, identifier: id }).lean();
  if (!row) {
    if (schema.cardinality === 'single') {
      return {
        collegeId,
        configType: type,
        identifier: SINGLETON_IDENTIFIER,
        values: defaultValuesForSchema(schema),
        enabled: true,
        isDefault: true,
      };
    }
    throw new AppError(404, `Config entry "${id}" not found for ${type}`);
  }
  return row;
}

// ─── Write ────────────────────────────────────────────────────────

interface UpsertInput {
  values: Record<string, unknown>;
  identifier?: string;
  label?: string;
  enabled?: boolean;
}

export async function upsertConfigEntry(
  collegeId: string,
  type: string,
  input: UpsertInput,
  performedBy: string,
): Promise<IConfigEntry> {
  const schema = mustGetSchema(type);

  // Validate values against the registered field list.
  const result = validateAgainstSchema(schema, input.values || {});
  if (!result.ok) {
    throw new AppError(400, `Validation failed: ${result.errors.map((e) => e.reason).join('; ')}`);
  }

  // Resolve identifier.
  let identifier: string;
  if (schema.cardinality === 'single') {
    identifier = SINGLETON_IDENTIFIER;
  } else {
    const idField = schema.identifierField;
    if (!idField) {
      throw new AppError(500, `Multi-cardinality schema "${type}" is missing identifierField`);
    }
    const fromInput = input.identifier ?? result.values[idField];
    if (!fromInput || typeof fromInput !== 'string') {
      throw new AppError(400, `${idField} is required`);
    }
    identifier = fromInput.trim();
  }

  const existing = await ConfigEntry.findOne({ collegeId, configType: type, identifier });
  const action: 'create' | 'update' = existing ? 'update' : 'create';

  const doc = await ConfigEntry.findOneAndUpdate(
    { collegeId, configType: type, identifier },
    {
      $set: {
        values: result.values,
        label: input.label,
        enabled: input.enabled !== undefined ? input.enabled : (existing?.enabled ?? true),
        updatedBy: performedBy,
      },
      $setOnInsert: {
        collegeId,
        configType: type,
        identifier,
        createdBy: performedBy,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  await createAuditLog({
    collegeId,
    entityType: 'ConfigEntry',
    entityId: String(doc._id),
    entityName: `${type}:${identifier}`,
    action,
    changes: [],
    performedBy,
  });

  return doc;
}

export async function deleteConfigEntry(
  collegeId: string,
  type: string,
  identifier: string,
  performedBy: string,
): Promise<{ deleted: true }> {
  const schema = mustGetSchema(type);
  if (schema.cardinality === 'single') {
    throw new AppError(400, 'Cannot delete a singleton config — disable it instead');
  }

  const doc = await ConfigEntry.findOneAndDelete({ collegeId, configType: type, identifier });
  if (!doc) throw new AppError(404, `Config entry "${identifier}" not found`);

  await createAuditLog({
    collegeId,
    entityType: 'ConfigEntry',
    entityId: String(doc._id),
    entityName: `${type}:${identifier}`,
    action: 'delete',
    changes: [],
    performedBy,
  });

  return { deleted: true };
}

// ─── Helpers ──────────────────────────────────────────────────────

export function defaultValuesForSchema(schema: ConfigSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of schema.fields) {
    if (f.default !== undefined) out[f.key] = f.default;
  }
  return out;
}

/**
 * Read a singleton config's values, falling back to registry defaults
 * if no DB row exists. Used by service-layer callers that want the
 * effective config (e.g. the feature-flag overlay in `config/features`).
 */
export async function getEffectiveSingletonValues(
  collegeId: string,
  type: string,
): Promise<Record<string, unknown>> {
  const schema = mustGetSchema(type);
  if (schema.cardinality !== 'single') {
    throw new AppError(400, `getEffectiveSingletonValues only works for single-cardinality types`);
  }
  const row = await ConfigEntry.findOne({
    collegeId,
    configType: type,
    identifier: SINGLETON_IDENTIFIER,
  }).lean();
  const defaults = defaultValuesForSchema(schema);
  if (!row) return defaults;
  return { ...defaults, ...(row.values || {}) };
}
