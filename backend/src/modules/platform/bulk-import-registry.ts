/**
 * bulk-import-registry — per-entity-type schemas + commit handlers.
 *
 * Adding a new entity type to the bulk-import surface is a SINGLE
 * registry entry: a list of fields, a sample (so the UI can render a
 * downloadable template), and a `commitOne` function that knows how
 * to turn a parsed CSV row into the canonical write to the target
 * collection.
 *
 * Strategic Gap 2 Phase A ships only the 'student' entry as proof-of-
 * pattern. Phase B will extend with applicants / faculty / staff /
 * subjects / fee-structures by appending more entries here — zero
 * new infrastructure code required.
 */

import * as peopleService from '../people/service';
import { IImportJobSchemaField } from '../../models/platform/ImportJob';

export interface ImportCommitContext {
  collegeId: string;
  performedBy: string;
}

export interface ImportSchemaField extends IImportJobSchemaField {
  /**
   * Validator. Receives the trimmed raw cell value AND the full row
   * (so cross-field validation can run). Returns either `{ ok: true,
   * value }` (the coerced typed value to pass to the commit handler)
   * or `{ ok: false, error }` to mark the row failed.
   */
  validate: (
    rawValue: string,
    row: Record<string, string>,
    ctx: ImportCommitContext,
  ) => { ok: true; value: unknown } | { ok: false; error: string };
}

export interface ImportSchemaDefinition {
  entityType: string;
  label: string;
  description: string;
  fields: ImportSchemaField[];
  /** Sample row for the downloadable CSV template. Keys must be `fieldKey`. */
  sampleRow: Record<string, string>;
  /**
   * Given a fully-validated typed row, perform the create + return
   * the _id. Throw `Error` on failure — the orchestrator catches and
   * records the per-row error.
   */
  commitOne: (
    typedRow: Record<string, unknown>,
    ctx: ImportCommitContext,
  ) => Promise<{ id: string }>;
}

// ─── Shared validators ───────────────────────────────────────────────

function validString(opts: { min?: number; max?: number; required: boolean }) {
  return (raw: string): { ok: true; value: string } | { ok: false; error: string } => {
    const v = raw.trim();
    if (!v) {
      return opts.required ? { ok: false, error: 'required' } : { ok: true, value: '' };
    }
    if (opts.min !== undefined && v.length < opts.min) {
      return { ok: false, error: `min length ${opts.min}` };
    }
    if (opts.max !== undefined && v.length > opts.max) {
      return { ok: false, error: `max length ${opts.max}` };
    }
    return { ok: true, value: v };
  };
}

function validNumber(opts: { required: boolean; min?: number; max?: number }) {
  return (raw: string): { ok: true; value: number } | { ok: false; error: string } => {
    const v = raw.trim();
    if (!v) {
      return opts.required ? { ok: false, error: 'required' } : { ok: true, value: NaN };
    }
    const n = Number(v);
    if (Number.isNaN(n)) return { ok: false, error: 'must be a number' };
    if (opts.min !== undefined && n < opts.min) return { ok: false, error: `min ${opts.min}` };
    if (opts.max !== undefined && n > opts.max) return { ok: false, error: `max ${opts.max}` };
    return { ok: true, value: n };
  };
}

function validEnum(opts: { required: boolean; values: ReadonlyArray<string> }) {
  return (raw: string): { ok: true; value: string } | { ok: false; error: string } => {
    const v = raw.trim();
    if (!v) {
      return opts.required ? { ok: false, error: 'required' } : { ok: true, value: '' };
    }
    if (!opts.values.includes(v)) {
      return { ok: false, error: `must be one of: ${opts.values.join(', ')}` };
    }
    return { ok: true, value: v };
  };
}

// ─── Schemas ─────────────────────────────────────────────────────────

const studentImportSchema: ImportSchemaDefinition = {
  entityType: 'student',
  label: 'Students',
  description:
    'Bulk-create student records. Personal identity + admission metadata. Roll number is optional — the system can assign on enroll. Quota and category accept any value from the FeeQuota / FeeCategory catalogs.',
  fields: [
    {
      fieldKey: 'name',
      label: 'Full Name',
      type: 'string',
      required: true,
      validate: validString({ required: true, min: 1, max: 200 }),
    },
    {
      fieldKey: 'phone',
      label: 'Phone (10 digits)',
      type: 'string',
      required: true,
      validate: (raw) => {
        const v = raw.trim();
        if (!v) return { ok: false, error: 'required' };
        if (!/^[0-9]{10}$/.test(v)) {
          return { ok: false, error: 'must be a 10-digit phone number' };
        }
        return { ok: true, value: v };
      },
    },
    {
      fieldKey: 'email',
      label: 'Email',
      type: 'string',
      required: false,
      validate: (raw) => {
        const v = raw.trim();
        if (!v) return { ok: true, value: '' };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          return { ok: false, error: 'invalid email format' };
        }
        return { ok: true, value: v };
      },
    },
    {
      fieldKey: 'gender',
      label: 'Gender',
      type: 'enum',
      required: false,
      meta: { values: ['male', 'female', 'other'] },
      validate: validEnum({ required: false, values: ['male', 'female', 'other'] }),
    },
    {
      fieldKey: 'dob',
      label: 'Date of Birth (YYYY-MM-DD)',
      type: 'date',
      required: false,
      validate: (raw) => {
        const v = raw.trim();
        if (!v) return { ok: true, value: '' };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
          return { ok: false, error: 'use YYYY-MM-DD' };
        }
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return { ok: false, error: 'invalid date' };
        return { ok: true, value: v };
      },
    },
    {
      fieldKey: 'aadhaar',
      label: 'Aadhaar (12 digits)',
      type: 'string',
      required: false,
      validate: (raw) => {
        const v = raw.trim().replace(/\s+/g, '');
        if (!v) return { ok: true, value: '' };
        if (!/^[0-9]{12}$/.test(v)) {
          return { ok: false, error: 'Aadhaar must be 12 digits' };
        }
        return { ok: true, value: v };
      },
    },
    {
      fieldKey: 'admissionYear',
      label: 'Admission Year',
      type: 'number',
      required: true,
      validate: validNumber({ required: true, min: 2000, max: 2100 }),
    },
    {
      fieldKey: 'rollNumber',
      label: 'Roll Number',
      type: 'string',
      required: false,
      validate: validString({ required: false, max: 50 }),
    },
    {
      fieldKey: 'quota',
      label: 'Quota Code',
      type: 'string',
      required: false,
      validate: validString({ required: false, max: 50 }),
    },
    {
      fieldKey: 'category',
      label: 'Category Code',
      type: 'string',
      required: false,
      validate: validString({ required: false, max: 50 }),
    },
    {
      fieldKey: 'status',
      label: 'Status',
      type: 'enum',
      required: false,
      meta: { values: ['prospective', 'active', 'year_back', 'detained', 'graduated', 'exited', 'alumni'] },
      validate: validEnum({
        required: false,
        values: ['prospective', 'active', 'year_back', 'detained', 'graduated', 'exited', 'alumni'],
      }),
    },
  ],
  sampleRow: {
    name: 'Aarav Sharma',
    phone: '9876543210',
    email: 'aarav.sharma@example.edu',
    gender: 'male',
    dob: '2005-03-15',
    aadhaar: '234567890101',
    admissionYear: '2024',
    rollNumber: '24B01A0501',
    quota: 'convener',
    category: 'BC-A',
    status: 'active',
  },
  async commitOne(typedRow, ctx) {
    // Build the payload createStudent expects. Map empty-string optional
    // fields out so we don't write blanks where downstream logic
    // expects undefined.
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(typedRow)) {
      if (v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))) continue;
      payload[k] = v;
    }
    // Default status to 'active' if omitted — matches manual create path.
    if (!payload.status) payload.status = 'active';
    const doc = await peopleService.createStudent(ctx.collegeId, payload, ctx.performedBy);
    return { id: String((doc as { _id: unknown })._id) };
  },
};

// ─── Registry ────────────────────────────────────────────────────────

const REGISTRY: ImportSchemaDefinition[] = [
  studentImportSchema,
  // Phase B append-only — applicants, faculty, staff, subjects,
  // fee-structures, fee-transactions, etc.
];

export function listImportEntityTypes(): ImportSchemaDefinition[] {
  return REGISTRY;
}

export function getImportSchema(entityType: string): ImportSchemaDefinition | null {
  return REGISTRY.find((d) => d.entityType === entityType) ?? null;
}

/** Strip the runtime functions so the schema can be sent over the wire. */
export function serializeSchema(def: ImportSchemaDefinition): {
  entityType: string;
  label: string;
  description: string;
  fields: IImportJobSchemaField[];
  sampleRow: Record<string, string>;
} {
  return {
    entityType: def.entityType,
    label: def.label,
    description: def.description,
    fields: def.fields.map(({ fieldKey, label, type, required, meta }) => ({
      fieldKey,
      label,
      type,
      required,
      meta,
    })),
    sampleRow: def.sampleRow,
  };
}
