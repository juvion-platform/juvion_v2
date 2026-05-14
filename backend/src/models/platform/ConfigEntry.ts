import { Schema, model, Document, Types } from 'mongoose';

/**
 * ConfigEntry — generic schema-driven runtime configuration storage.
 * Strategic Gap 3 Phase A.
 *
 * The shape we mirror from CampX: 7 separate schema-driven config
 * subsystems (data-imports, student-services, ReportsForge, institution-
 * config, registration-form-config, notifications, naming-series) all
 * share one back-end pattern — describe the fields server-side, the
 * front-end renders form/list automatically. New config types added
 * via registry, not new tables/routes/pages.
 *
 * Storage shape:
 *   - `configType` discriminates which registry entry owns the row.
 *   - `identifier` keys multi-cardinality types (e.g. notification-
 *     template `code = "fee_due_reminder"`). For single-cardinality
 *     types (one per college), `identifier = "__singleton__"`.
 *   - `values` is the typed payload, validated server-side against the
 *     registered schema before write. Stored as Mixed so any registered
 *     schema can persist its shape — the registry is the source of truth
 *     for what's allowed inside.
 *
 * Multi-tenancy: every row carries `collegeId`. The compound unique
 * index `(collegeId, configType, identifier)` enforces "at most one
 * entry per (college, type, identifier)" — singleton types collapse
 * to one row via the sentinel.
 */

export const SINGLETON_IDENTIFIER = '__singleton__';

export interface IConfigEntry extends Document {
  collegeId: Types.ObjectId;
  configType: string;
  identifier: string;
  values: Record<string, unknown>;
  /** Display label for multi-cardinality rows; ignored for singletons. */
  label?: string;
  /** Toggle without deleting — useful for templates that get retired. */
  enabled: boolean;
  /** Audit. */
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IConfigEntry>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    configType: { type: String, required: true, trim: true },
    identifier: { type: String, required: true, trim: true, default: SINGLETON_IDENTIFIER },
    values: { type: Schema.Types.Mixed, required: true, default: {} },
    label: { type: String, trim: true },
    enabled: { type: Boolean, required: true, default: true },
    createdBy: { type: String, trim: true },
    updatedBy: { type: String, trim: true },
  },
  { timestamps: true },
);

// One row per (college, type, identifier). Singletons collapse via the
// sentinel identifier. Multi-cardinality types use admin-set codes.
schema.index({ collegeId: 1, configType: 1, identifier: 1 }, { unique: true });

// List by type within a tenant — the hot path for the admin UI.
schema.index({ collegeId: 1, configType: 1, enabled: 1 });

export const ConfigEntry = model<IConfigEntry>('ConfigEntry', schema);
