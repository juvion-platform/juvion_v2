/**
 * fee-category-service — CRUD for the per-college FeeCategory catalog.
 *
 * The catalog feeds the `Category` dropdown on `FeeStructure` (admin portal)
 * and is referenced by `FeeStructure.category` as a STRING `code` (not an
 * ObjectId). Downstream consumers — notably `fee-pin-service` — match
 * `FeeStructure.category` to `Student.category` by string equality, so the
 * wire contract MUST stay a string. This service exists to give admins a
 * managed list of valid codes (OC, OBC, SC, ST, NRI, …) without changing
 * the FeeStructure model or the pin-resolver contract.
 *
 * Pattern mirrors `fee-component-template-service.ts`:
 *   - All CRUD takes `collegeId` first
 *   - CUD takes `performedBy` last and emits `createAuditLog`
 *   - Friendly 409 pre-check on create + on update-if-code-changes
 *   - Use String(doc._id) when storing the audit entityId
 */

import { FeeCategory, IFeeCategory, FeeCategoryStatus } from '../../models/finance/FeeCategory';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import { paginate } from '../../shared/pagination';
import { PaginatedResult } from '../../shared/types';

// ── Types ─────────────────────────────────────────────────────────────

export interface ListCategoriesOpts {
  page?: number;
  limit?: number;
  status?: FeeCategoryStatus;
}

export interface CreateCategoryInput {
  code: string;
  name: string;
  description?: string;
  status?: FeeCategoryStatus;
}

export interface UpdateCategoryInput {
  code?: string;
  name?: string;
  description?: string;
  status?: FeeCategoryStatus;
}

// ── Reads ─────────────────────────────────────────────────────────────

/**
 * Paginated list of FeeCategory rows for a college, optionally filtered by
 * status. Sorted by `code` ascending so the admin UI sees a stable order
 * (OC, OBC, SC, ST, …).
 */
export async function listCategories(
  collegeId: string,
  opts: ListCategoriesOpts = {},
): Promise<PaginatedResult<IFeeCategory>> {
  const { page = 1, limit = 20, status } = opts;
  const filter: Record<string, unknown> = { collegeId };
  if (status) filter.status = status;
  return paginate(FeeCategory, filter, page, limit, { code: 1 });
}

export async function getCategory(
  collegeId: string,
  id: string,
): Promise<IFeeCategory> {
  const doc = await FeeCategory.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Fee category not found');
  return doc;
}

// ── Writes ────────────────────────────────────────────────────────────

export async function createCategory(
  collegeId: string,
  data: CreateCategoryInput,
  performedBy: string,
): Promise<IFeeCategory> {
  const code = data.code.trim();
  // Friendly 409 pre-check — the unique index is the enforcement of record.
  const existing = await FeeCategory.findOne({ collegeId, code }).lean();
  if (existing) {
    throw new AppError(
      409,
      `Fee category with code "${code}" already exists for this college.`,
    );
  }

  const doc = await FeeCategory.create({
    collegeId,
    code,
    name: data.name.trim(),
    description: data.description?.trim(),
    status: data.status ?? 'active',
  });

  await createAuditLog({
    collegeId,
    entityType: 'FeeCategory',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function updateCategory(
  collegeId: string,
  id: string,
  data: UpdateCategoryInput,
  performedBy: string,
): Promise<IFeeCategory> {
  const doc = await FeeCategory.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Fee category not found');

  if (data.code !== undefined) {
    const newCode = data.code.trim();
    if (newCode !== doc.code) {
      // Pre-check duplicate before mutating.
      const dup = await FeeCategory.findOne({
        collegeId,
        code: newCode,
        _id: { $ne: doc._id },
      }).lean();
      if (dup) {
        throw new AppError(
          409,
          `Fee category with code "${newCode}" already exists for this college.`,
        );
      }
      doc.code = newCode;
    }
  }
  if (data.name !== undefined) doc.name = data.name.trim();
  if (data.description !== undefined) doc.description = data.description.trim();
  if (data.status !== undefined) doc.status = data.status;
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'FeeCategory',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'update',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function deleteCategory(
  collegeId: string,
  id: string,
  performedBy: string,
): Promise<void> {
  const doc = await FeeCategory.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Fee category not found');

  const name = doc.name;
  const docId = String(doc._id);
  await doc.deleteOne();

  await createAuditLog({
    collegeId,
    entityType: 'FeeCategory',
    entityId: docId,
    entityName: name,
    action: 'delete',
    changes: [],
    performedBy,
  });
}
