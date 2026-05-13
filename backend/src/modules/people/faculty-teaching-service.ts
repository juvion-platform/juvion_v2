/**
 * faculty-teaching-service — CRUD for the three Phase D
 * sub-collections under Faculty:
 *
 *   - FacultySubjectAssignment  (what they teach)         — NAAC 2.2 / 2.6
 *   - FacultyResearchScholar    (PhDs/M.Tech guided)      — NAAC 3.4.2
 *   - FacultyBook               (authored / edited)       — NAAC 3.3
 *
 * Each entity has the same CRUD shape (list / get / create / update /
 * archive) so this single file groups them together. Verification
 * workflow does NOT apply here — internal records that the institution
 * self-certifies; the AI verification agent in Phase E (separate spec)
 * can later cross-reference Books against DOI / ISBN APIs if useful.
 *
 * Multi-tenancy: every operation is scoped to `collegeId` and runs
 * `loadFacultyScoped` first so a leaked facultyId can't read or write
 * into another tenant.
 *
 * Soft-delete via `archivedAt` mirrors the FacultyDocument pattern.
 */

import { Types, Model, FilterQuery, Document } from 'mongoose';

import { Faculty } from '../../models/people/Faculty';
import {
  FacultySubjectAssignment,
  IFacultySubjectAssignment,
} from '../../models/people/FacultySubjectAssignment';
import {
  FacultyResearchScholar,
  IFacultyResearchScholar,
} from '../../models/people/FacultyResearchScholar';
import { FacultyBook, IFacultyBook } from '../../models/people/FacultyBook';
import { AppError } from '../../middleware/errorHandler';

// ─── Shared helpers ───────────────────────────────────────────────────

interface ScopedIds {
  facultyOid: Types.ObjectId;
  collegeOid: Types.ObjectId;
}

async function loadFacultyScoped(
  collegeId: string,
  facultyId: string,
): Promise<ScopedIds> {
  if (!Types.ObjectId.isValid(facultyId)) {
    throw new AppError(404, 'Faculty not found');
  }
  const cid = new Types.ObjectId(collegeId);
  const fid = new Types.ObjectId(facultyId);
  const fac = await Faculty.findOne({ _id: fid, collegeId: cid }).select({ _id: 1 }).lean();
  if (!fac) throw new AppError(404, 'Faculty not found');
  return { facultyOid: fid, collegeOid: cid };
}

/**
 * Generic CRUD generator. Each of the three entities gets its own
 * service via this factory — different field validations live in the
 * caller (we don't validate field-by-field here; the routes use Zod
 * for that). This factory just provides the shape.
 */
// TDoc must be a Mongoose Document so `.save()` is available. Each
// concrete entity also carries `archivedAt`, but the generic doesn't
// promise that — service-level archive uses a cast which is the most
// idiomatic Mongoose way to handle "this property is on every model
// even though TypeScript can't infer it through the generic."
function makeCrud<TDoc extends Document>(
  Model_: Model<TDoc>,
  entityName: string,
) {
  return {
    async list(collegeId: string, facultyId: string): Promise<TDoc[]> {
      const { facultyOid, collegeOid } = await loadFacultyScoped(collegeId, facultyId);
      return Model_.find({
        collegeId: collegeOid,
        facultyId: facultyOid,
        archivedAt: null,
      } as FilterQuery<TDoc>).sort({ createdAt: -1 } as Record<string, 1 | -1>);
    },

    async getOne(collegeId: string, facultyId: string, id: string): Promise<TDoc> {
      const { facultyOid, collegeOid } = await loadFacultyScoped(collegeId, facultyId);
      if (!Types.ObjectId.isValid(id)) {
        throw new AppError(404, `${entityName} not found`);
      }
      const doc = await Model_.findOne({
        _id: new Types.ObjectId(id),
        collegeId: collegeOid,
        facultyId: facultyOid,
        archivedAt: null,
      } as FilterQuery<TDoc>);
      if (!doc) throw new AppError(404, `${entityName} not found`);
      return doc;
    },

    async create(collegeId: string, facultyId: string, data: Record<string, unknown>): Promise<TDoc> {
      const { facultyOid, collegeOid } = await loadFacultyScoped(collegeId, facultyId);
      return Model_.create({
        ...data,
        collegeId: collegeOid,
        facultyId: facultyOid,
      } as unknown as Partial<TDoc>);
    },

    async update(
      collegeId: string,
      facultyId: string,
      id: string,
      patch: Record<string, unknown>,
    ): Promise<TDoc> {
      const doc = await this.getOne(collegeId, facultyId, id);
      // Never let a caller mutate the multi-tenancy keys via PATCH —
      // strip them before assigning.
      delete (patch as Record<string, unknown>).collegeId;
      delete (patch as Record<string, unknown>).facultyId;
      delete (patch as Record<string, unknown>).archivedAt;
      Object.assign(doc, patch);
      await doc.save();
      return doc;
    },

    async archive(collegeId: string, facultyId: string, id: string): Promise<{ archived: true; archivedAt: Date }> {
      const doc = await this.getOne(collegeId, facultyId, id);
      const archivedAt = new Date();
      (doc as unknown as { archivedAt: Date }).archivedAt = archivedAt;
      await doc.save();
      return { archived: true, archivedAt };
    },
  };
}

// ─── Public per-entity CRUD bundles ───────────────────────────────────

export const subjectAssignments = makeCrud<IFacultySubjectAssignment>(
  FacultySubjectAssignment,
  'Subject assignment',
);

export const researchScholars = makeCrud<IFacultyResearchScholar>(
  FacultyResearchScholar,
  'Research scholar',
);

export const books = makeCrud<IFacultyBook>(FacultyBook, 'Book');
