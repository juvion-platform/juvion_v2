/**
 * Reference resolution for the student bulk import.
 *
 * Operators fill a spreadsheet with human-readable codes, not ObjectIds.
 * This turns those codes into ids, scoped to the calling college.
 *
 * Nothing here creates records: an unmatched programme/branch/batch/
 * regulation/quota/category code is a typo, not intake data, so the row
 * fails with a message naming the offending value. Parents are the one
 * exception and are handled in student-import-service.ts.
 */
import { Programme } from '../../models/academic-structure/Programme';
import { Branch } from '../../models/academic-structure/Branch';
import { Batch } from '../../models/academic-structure/Batch';
import { Regulation } from '../../models/academic-structure/Regulation';
import { FeeQuota } from '../../models/finance/FeeQuota';
import { FeeCategory } from '../../models/finance/FeeCategory';

export interface ResolvedRefs {
  programmeId: string;
  /** Carried so preview can show what a code resolved to, not just that it did. */
  programmeName: string;
  branchId?: string;
  branchName?: string;
  batchId?: string;
  regulationId?: string;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function cell(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

export async function resolveStudentRefs(
  collegeId: string,
  row: Record<string, unknown>,
): Promise<Result<ResolvedRefs>> {
  const programmeCode = cell(row, 'programmeCode');
  if (!programmeCode) return { ok: false, error: 'programmeCode is required' };

  const programme = await Programme.findOne({ collegeId, code: programmeCode }).select('_id name').lean();
  if (!programme) return { ok: false, error: `unknown programme code "${programmeCode}"` };

  const out: ResolvedRefs = { programmeId: String(programme._id), programmeName: programme.name };

  const branchCode = cell(row, 'branchCode');
  if (branchCode) {
    const branch = await Branch.findOne({ collegeId, code: branchCode }).select('_id name').lean();
    if (!branch) return { ok: false, error: `unknown branch code "${branchCode}"` };
    out.branchId = String(branch._id);
    out.branchName = branch.name;
  }

  const batchCode = cell(row, 'batchCode');
  if (batchCode) {
    const batch = await Batch.findOne({ collegeId, code: batchCode }).select('_id').lean();
    if (!batch) return { ok: false, error: `unknown batch code "${batchCode}"` };
    out.batchId = String(batch._id);
  }

  const regulationCode = cell(row, 'regulationCode');
  if (regulationCode) {
    const regulation = await Regulation.findOne({ collegeId, code: regulationCode }).select('_id').lean();
    if (!regulation) return { ok: false, error: `unknown regulation code "${regulationCode}"` };
    out.regulationId = String(regulation._id);
  }

  return { ok: true, value: out };
}

/**
 * Quota and category are admin-managed catalogs with no model enum, and the
 * pre-existing importer accepted any string. Validating is a deliberate
 * behaviour change: an unrecognised quota silently produces a student that
 * never fee-pins, which is far harder to notice than a rejected row.
 */
export async function validateCatalogCodes(
  collegeId: string,
  row: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const quota = cell(row, 'quota');
  if (quota) {
    const found = await FeeQuota.findOne({ collegeId, code: quota, status: { $ne: 'inactive' } }).select('_id').lean();
    if (!found) return { ok: false, error: `unknown quota code "${quota}"` };
  }

  const category = cell(row, 'category');
  if (category) {
    const found = await FeeCategory.findOne({ collegeId, code: category, status: { $ne: 'inactive' } }).select('_id').lean();
    if (!found) return { ok: false, error: `unknown category code "${category}"` };
  }

  return { ok: true };
}
