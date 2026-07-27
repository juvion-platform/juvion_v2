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
import * as admissionsService from '../admissions/service';
import * as academicsService from '../academics/service';
import { IImportJobSchemaField } from '../../models/platform/ImportJob';

import type {
  ImportCommitContext, ImportSchemaField, ImportSchemaDefinition,
} from './import-schemas/types';
import { validString, validNumber, validEnum } from './import-schemas/validators';
import { studentImportSchema } from './import-schemas/student';

export type { ImportCommitContext, ImportSchemaField, ImportSchemaDefinition };

// ─── Faculty ─────────────────────────────────────────────────────────

const facultyImportSchema: ImportSchemaDefinition = {
  entityType: 'faculty',
  label: 'Faculty',
  description:
    'Bulk-create faculty (teaching staff) records. Personal identity + employment details. departmentId is optional and accepts the department code OR ObjectId.',
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
      fieldKey: 'employeeCode',
      label: 'Employee Code',
      type: 'string',
      required: true,
      validate: validString({ required: true, min: 1, max: 50 }),
    },
    {
      fieldKey: 'designation',
      label: 'Designation',
      type: 'string',
      required: true,
      validate: validString({ required: true, min: 1, max: 100 }),
    },
    {
      fieldKey: 'specialization',
      label: 'Specialization',
      type: 'string',
      required: false,
      validate: validString({ required: false, max: 200 }),
    },
    {
      fieldKey: 'qualification',
      label: 'Qualification',
      type: 'string',
      required: false,
      validate: validString({ required: false, max: 100 }),
    },
    {
      fieldKey: 'contractType',
      label: 'Contract Type',
      type: 'enum',
      required: false,
      meta: { values: ['regular', 'contract', 'adjunct', 'visiting'] },
      validate: validEnum({
        required: false,
        values: ['regular', 'contract', 'adjunct', 'visiting'],
      }),
    },
    {
      fieldKey: 'status',
      label: 'Status',
      type: 'enum',
      required: false,
      meta: { values: ['active', 'on_leave', 'separated'] },
      validate: validEnum({
        required: false,
        values: ['active', 'on_leave', 'separated'],
      }),
    },
  ],
  sampleRow: {
    name: 'Dr. Ramesh Iyer',
    phone: '9876543220',
    email: 'ramesh.iyer@example.edu',
    gender: 'male',
    employeeCode: 'FAC001',
    designation: 'Professor',
    specialization: 'Computer Science',
    qualification: 'Ph.D',
    contractType: 'regular',
    status: 'active',
  },
  async commitOne(typedRow, ctx) {
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(typedRow)) {
      if (v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))) continue;
      payload[k] = v;
    }
    if (!payload.contractType) payload.contractType = 'regular';
    if (!payload.status) payload.status = 'active';
    const doc = await peopleService.createFaculty(ctx.collegeId, payload, ctx.performedBy);
    return { id: String((doc as { _id: unknown })._id) };
  },
};

// ─── Staff ───────────────────────────────────────────────────────────

const staffImportSchema: ImportSchemaDefinition = {
  entityType: 'staff',
  label: 'Staff',
  description:
    'Bulk-create non-teaching staff records (administrative officers, hostel wardens, librarians, transport coordinators, etc.).',
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
      fieldKey: 'employeeCode',
      label: 'Employee Code',
      type: 'string',
      required: true,
      validate: validString({ required: true, min: 1, max: 50 }),
    },
    {
      fieldKey: 'designation',
      label: 'Designation',
      type: 'string',
      required: true,
      validate: validString({ required: true, min: 1, max: 100 }),
    },
    {
      fieldKey: 'staffType',
      label: 'Staff Type',
      type: 'string',
      required: true,
      // Staff.staffType is a free string in the model (admin/warden/
      // librarian/transport/security/maintenance/etc.) — institutions
      // pick their own taxonomy.
      validate: validString({ required: true, min: 1, max: 50 }),
    },
    {
      fieldKey: 'status',
      label: 'Status',
      type: 'enum',
      required: false,
      meta: { values: ['active', 'on_leave', 'separated'] },
      validate: validEnum({
        required: false,
        values: ['active', 'on_leave', 'separated'],
      }),
    },
  ],
  sampleRow: {
    name: 'Ravi Teja',
    phone: '9876543226',
    email: 'ravi.teja@example.edu',
    employeeCode: 'STAFF001',
    designation: 'Administrative Officer',
    staffType: 'admin',
    status: 'active',
  },
  async commitOne(typedRow, ctx) {
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(typedRow)) {
      if (v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))) continue;
      payload[k] = v;
    }
    if (!payload.status) payload.status = 'active';
    const doc = await peopleService.createStaff(ctx.collegeId, payload, ctx.performedBy);
    return { id: String((doc as { _id: unknown })._id) };
  },
};

// ─── Applicants ──────────────────────────────────────────────────────

const applicantImportSchema: ImportSchemaDefinition = {
  entityType: 'applicant',
  label: 'Applicants',
  description:
    'Bulk-create admissions applicants. Personal identity + entrance exam scores + programme preferences. Use for batch-importing exam rank lists or migrating from a legacy admissions system.',
  fields: [
    {
      fieldKey: 'applicationNumber',
      label: 'Application Number',
      type: 'string',
      required: true,
      validate: validString({ required: true, min: 1, max: 50 }),
    },
    {
      fieldKey: 'name',
      label: 'Full Name',
      type: 'string',
      required: true,
      validate: validString({ required: true, min: 1, max: 200 }),
    },
    {
      fieldKey: 'fatherName',
      label: "Father's Name",
      type: 'string',
      required: false,
      validate: validString({ required: false, max: 200 }),
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
      fieldKey: 'dateOfBirth',
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
      fieldKey: 'programmeApplied',
      label: 'Programme Applied',
      type: 'string',
      required: false,
      validate: validString({ required: false, max: 100 }),
    },
    {
      fieldKey: 'branchPreference1',
      label: 'Branch Preference 1',
      type: 'string',
      required: false,
      validate: validString({ required: false, max: 50 }),
    },
    {
      fieldKey: 'branchPreference2',
      label: 'Branch Preference 2',
      type: 'string',
      required: false,
      validate: validString({ required: false, max: 50 }),
    },
    {
      fieldKey: 'branchPreference3',
      label: 'Branch Preference 3',
      type: 'string',
      required: false,
      validate: validString({ required: false, max: 50 }),
    },
    {
      fieldKey: 'quota',
      label: 'Quota Code',
      type: 'string',
      required: true,
      validate: validString({ required: true, max: 50 }),
    },
    {
      fieldKey: 'category',
      label: 'Category Code',
      type: 'string',
      required: false,
      validate: validString({ required: false, max: 50 }),
    },
    {
      fieldKey: 'eamcetRank',
      label: 'EAMCET Rank',
      type: 'number',
      required: false,
      validate: validNumber({ required: false, min: 0 }),
    },
    {
      fieldKey: 'eamcetScore',
      label: 'EAMCET Score',
      type: 'number',
      required: false,
      validate: validNumber({ required: false, min: 0 }),
    },
    {
      fieldKey: 'jeeRank',
      label: 'JEE Rank',
      type: 'number',
      required: false,
      validate: validNumber({ required: false, min: 0 }),
    },
    {
      fieldKey: 'tenthPercentage',
      label: '10th %',
      type: 'number',
      required: false,
      validate: validNumber({ required: false, min: 0, max: 100 }),
    },
    {
      fieldKey: 'interPercentage',
      label: 'Inter %',
      type: 'number',
      required: false,
      validate: validNumber({ required: false, min: 0, max: 100 }),
    },
  ],
  sampleRow: {
    applicationNumber: 'APP2024001',
    name: 'Rithika Sai',
    fatherName: 'Sai Prasad',
    phone: '9876500020',
    email: 'rithika@example.com',
    gender: 'female',
    dateOfBirth: '2006-03-10',
    programmeApplied: 'B.Tech',
    branchPreference1: 'CSE',
    branchPreference2: 'ECE',
    branchPreference3: 'IT',
    quota: 'convener',
    category: 'OC',
    eamcetRank: '1500',
    eamcetScore: '',
    jeeRank: '',
    tenthPercentage: '95',
    interPercentage: '92',
  },
  async commitOne(typedRow, ctx) {
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(typedRow)) {
      if (v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))) continue;
      payload[k] = v;
    }
    const doc = await admissionsService.createApplicant(
      ctx.collegeId,
      payload,
      ctx.performedBy,
    );
    return { id: String((doc as { _id: unknown })._id) };
  },
};

// ─── Programmes ──────────────────────────────────────────────────────

const programmeImportSchema: ImportSchemaDefinition = {
  entityType: 'programme',
  label: 'Programmes',
  description:
    'Bulk-create academic programmes (B.Tech, M.Tech, MBA, etc.). Code must be unique per college. regulationId is optional in v1 — set blank and link via the manual UI later.',
  fields: [
    {
      fieldKey: 'code',
      label: 'Code',
      type: 'string',
      required: true,
      validate: validString({ required: true, min: 1, max: 20 }),
    },
    {
      fieldKey: 'name',
      label: 'Name',
      type: 'string',
      required: true,
      validate: validString({ required: true, min: 1, max: 200 }),
    },
    {
      fieldKey: 'level',
      label: 'Level',
      type: 'enum',
      required: true,
      meta: { values: ['UG', 'PG', 'Diploma', 'PhD'] },
      validate: validEnum({
        required: true,
        values: ['UG', 'PG', 'Diploma', 'PhD'],
      }),
    },
    {
      fieldKey: 'durationYears',
      label: 'Duration (Years)',
      type: 'number',
      required: true,
      validate: validNumber({ required: true, min: 1, max: 10 }),
    },
    {
      fieldKey: 'isActive',
      label: 'Is Active (true/false)',
      type: 'boolean',
      required: false,
      validate: (raw) => {
        const v = raw.trim().toLowerCase();
        if (!v) return { ok: true, value: true };
        if (['true', '1', 'yes', 'y'].includes(v)) return { ok: true, value: true };
        if (['false', '0', 'no', 'n'].includes(v)) return { ok: true, value: false };
        return { ok: false, error: "use true/false or yes/no" };
      },
    },
  ],
  sampleRow: {
    code: 'BTECH',
    name: 'Bachelor of Technology',
    level: 'UG',
    durationYears: '4',
    isActive: 'true',
  },
  async commitOne(typedRow, ctx) {
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(typedRow)) {
      if (v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))) continue;
      payload[k] = v;
    }
    if (payload.isActive === undefined) payload.isActive = true;
    const doc = await academicsService.createProgramme(
      ctx.collegeId,
      payload,
      ctx.performedBy,
    );
    return { id: String((doc as { _id: unknown })._id) };
  },
};

// ─── Registry ────────────────────────────────────────────────────────

const REGISTRY: ImportSchemaDefinition[] = [
  // Phase A (proof-of-pattern)
  studentImportSchema,
  // Phase B — extends the pre-launch coverage
  facultyImportSchema,
  staffImportSchema,
  applicantImportSchema,
  programmeImportSchema,
  // Future Phase B / C — branches, departments, regulations, batches,
  // subjects (no model yet), fee-structures (nested components — needs
  // schema-driven nesting), fee-transactions.
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
