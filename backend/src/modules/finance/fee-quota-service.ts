/**
 * fee-quota-service — CRUD for the per-college FeeQuota catalog.
 *
 * The catalog feeds the `Quota` dropdown on FeeStructure and Student
 * forms (admin portal) and is referenced by `Student.quota` /
 * `FeeStructureInstance.quota` as a STRING `code` (not an ObjectId).
 * Downstream consumers — notably `fee-pin-service` — match
 * `student.quota` to `FeeStructureInstance.quota` by string equality,
 * so the wire contract MUST stay a string. This service exists to
 * give admins a managed list of valid codes (convener, management,
 * nri, spot, lateral, …) without changing the underlying models or
 * the pin-resolver contract.
 *
 * Pattern mirrors `fee-category-service.ts`:
 *   - All CRUD takes `collegeId` first
 *   - CUD takes `performedBy` last and emits `createAuditLog`
 *   - Friendly 409 pre-check on create + on update-if-code-changes
 *   - Use String(doc._id) when storing the audit entityId
 */

import { FeeQuota, IFeeQuota, FeeQuotaStatus } from '../../models/finance/FeeQuota';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import { paginate } from '../../shared/pagination';
import { PaginatedResult } from '../../shared/types';

// ── Types ─────────────────────────────────────────────────────────────

export interface ListQuotasOpts {
  page?: number;
  limit?: number;
  status?: FeeQuotaStatus;
}

export interface CreateQuotaInput {
  code: string;
  name: string;
  description?: string;
  status?: FeeQuotaStatus;
}

export interface UpdateQuotaInput {
  code?: string;
  name?: string;
  description?: string;
  status?: FeeQuotaStatus;
}

// ── Reads ─────────────────────────────────────────────────────────────

/**
 * Paginated list of FeeQuota rows for a college, optionally filtered
 * by status. Sorted by `code` ascending so the admin UI sees a stable
 * order (convener, lateral, management, nri, spot).
 */
export async function listQuotas(
  collegeId: string,
  opts: ListQuotasOpts = {},
): Promise<PaginatedResult<IFeeQuota>> {
  const { page = 1, limit = 20, status } = opts;
  const filter: Record<string, unknown> = { collegeId };
  if (status) filter.status = status;
  return paginate(FeeQuota, filter, page, limit, { code: 1 });
}

export async function getQuota(
  collegeId: string,
  id: string,
): Promise<IFeeQuota> {
  const doc = await FeeQuota.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Fee quota not found');
  return doc;
}

// ── Writes ────────────────────────────────────────────────────────────

export async function createQuota(
  collegeId: string,
  data: CreateQuotaInput,
  performedBy: string,
): Promise<IFeeQuota> {
  const code = data.code.trim();
  // Friendly 409 pre-check — the unique index is the enforcement of
  // record.
  const existing = await FeeQuota.findOne({ collegeId, code }).lean();
  if (existing) {
    throw new AppError(
      409,
      `Fee quota with code "${code}" already exists for this college.`,
    );
  }

  const doc = await FeeQuota.create({
    collegeId,
    code,
    name: data.name.trim(),
    description: data.description?.trim(),
    status: data.status ?? 'active',
  });

  await createAuditLog({
    collegeId,
    entityType: 'FeeQuota',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function updateQuota(
  collegeId: string,
  id: string,
  data: UpdateQuotaInput,
  performedBy: string,
): Promise<IFeeQuota> {
  const doc = await FeeQuota.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Fee quota not found');

  if (data.code !== undefined) {
    const newCode = data.code.trim();
    if (newCode !== doc.code) {
      // Pre-check duplicate before mutating.
      const dup = await FeeQuota.findOne({
        collegeId,
        code: newCode,
        _id: { $ne: doc._id },
      }).lean();
      if (dup) {
        throw new AppError(
          409,
          `Fee quota with code "${newCode}" already exists for this college.`,
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
    entityType: 'FeeQuota',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'update',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function deleteQuota(
  collegeId: string,
  id: string,
  performedBy: string,
): Promise<void> {
  const doc = await FeeQuota.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Fee quota not found');

  const name = doc.name;
  const docId = String(doc._id);
  await doc.deleteOne();

  await createAuditLog({
    collegeId,
    entityType: 'FeeQuota',
    entityId: docId,
    entityName: name,
    action: 'delete',
    changes: [],
    performedBy,
  });
}
