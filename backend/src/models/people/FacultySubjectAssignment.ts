import { Schema, model, Document, Types } from 'mongoose';

/**
 * FacultySubjectAssignment — what a faculty member teaches (or has
 * taught) and in what capacity. Strategic Gap 1 Phase D.
 *
 * NAAC criteria served:
 *   - 2.2 (Catering to student diversity / workload)
 *   - 2.6 (Student-teacher ratio, taught hours)
 *
 * Subject is captured as `subjectCode` + `subjectName` strings rather
 * than a hard ref to the M03 Subject model — institutions often have
 * legacy subject codes that don't exist in the current catalog, and
 * forcing a ref would block historical entry. The optional
 * `subjectId` slot lets us upgrade to a ref later without a migration
 * (set both, then drop subjectName from new writes).
 *
 * Multi-tenancy: every row carries `collegeId`. Composite index on
 * (collegeId, facultyId) drives the per-faculty panel listing; index
 * on (collegeId, academicYear, semester) drives any future workload
 * analytics.
 */

export type FacultySubjectRole =
  | 'instructor'
  | 'co_instructor'
  | 'lab_incharge'
  | 'tutorial';

export type FacultySubjectStatus = 'planned' | 'active' | 'completed';

export interface IFacultySubjectAssignment extends Document {
  collegeId: Types.ObjectId;
  facultyId: Types.ObjectId;

  // Subject — string-first per the rationale above
  subjectCode: string;
  subjectName: string;
  subjectId?: Types.ObjectId;

  academicYear: string;     // e.g. "2025-26"
  semester?: number;        // 1-8 typical
  role: FacultySubjectRole;
  weeklyHours?: number;
  studentCount?: number;
  status: FacultySubjectStatus;
  notes?: string;
  archivedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IFacultySubjectAssignment>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true, index: true },

    subjectCode: { type: String, required: true, trim: true },
    subjectName: { type: String, required: true, trim: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject' },

    academicYear: { type: String, required: true, trim: true },
    semester: { type: Number, min: 1, max: 12 },
    role: {
      type: String,
      enum: ['instructor', 'co_instructor', 'lab_incharge', 'tutorial'],
      required: true,
      default: 'instructor',
    },
    weeklyHours: { type: Number, min: 0 },
    studentCount: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ['planned', 'active', 'completed'],
      required: true,
      default: 'active',
    },
    notes: { type: String, trim: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, facultyId: 1, archivedAt: 1 });
schema.index({ collegeId: 1, academicYear: 1, semester: 1 });

export const FacultySubjectAssignment = model<IFacultySubjectAssignment>(
  'FacultySubjectAssignment',
  schema,
);
