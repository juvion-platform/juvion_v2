/**
 * faculty-teaching-controller — HTTP layer for the three Phase D
 * sub-collections under Faculty.
 *
 * Routes served (mounted under /api/people in routes.ts):
 *   /faculty/:facultyId/subjects      — FacultySubjectAssignment
 *   /faculty/:facultyId/scholars      — FacultyResearchScholar
 *   /faculty/:facultyId/books         — FacultyBook
 *
 * Each surface gets the same 5 endpoints (list / create / get /
 * patch / archive). The handlers are generic — they read the CRUD
 * bundle for the matching entity and dispatch.
 *
 * Substantive logic lives in `faculty-teaching-service.ts`.
 */

import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../middleware/authenticate';
import {
  subjectAssignments,
  researchScholars,
  books,
} from './faculty-teaching-service';

/**
 * Shared CRUD-bundle shape. All three Phase D services expose this
 * surface — we type the controller against the union rather than
 * trying to pin a single generic so each handler is happily generic
 * over the row type.
 */
interface CrudBundle {
  list(collegeId: string, facultyId: string): Promise<unknown>;
  getOne(collegeId: string, facultyId: string, id: string): Promise<unknown>;
  create(collegeId: string, facultyId: string, data: Record<string, unknown>): Promise<unknown>;
  update(collegeId: string, facultyId: string, id: string, patch: Record<string, unknown>): Promise<unknown>;
  archive(collegeId: string, facultyId: string, id: string): Promise<{ archived: true; archivedAt: Date }>;
}

function makeHandlers(bundle: CrudBundle) {
  return {
    async list(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const { facultyId } = req.params as { facultyId: string };
        const items = await bundle.list(req.collegeId!, facultyId);
        res.json({ items });
      } catch (err) { next(err); }
    },
    async create(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const { facultyId } = req.params as { facultyId: string };
        const doc = await bundle.create(req.collegeId!, facultyId, req.body || {});
        res.status(201).json(doc);
      } catch (err) { next(err); }
    },
    async getOne(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const { facultyId, id } = req.params as { facultyId: string; id: string };
        const doc = await bundle.getOne(req.collegeId!, facultyId, id);
        res.json(doc);
      } catch (err) { next(err); }
    },
    async update(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const { facultyId, id } = req.params as { facultyId: string; id: string };
        const doc = await bundle.update(req.collegeId!, facultyId, id, req.body || {});
        res.json(doc);
      } catch (err) { next(err); }
    },
    async archive(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const { facultyId, id } = req.params as { facultyId: string; id: string };
        const result = await bundle.archive(req.collegeId!, facultyId, id);
        res.json(result);
      } catch (err) { next(err); }
    },
  };
}

export const subjectHandlers = makeHandlers(subjectAssignments);
export const scholarHandlers = makeHandlers(researchScholars);
export const bookHandlers = makeHandlers(books);
