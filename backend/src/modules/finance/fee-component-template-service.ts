/**
 * fee-component-template-service (Task 6 — Fee Configuration)
 *
 * CRUD for the `FeeComponentTemplate` catalog per college, with safeguards
 * for default (seeded) vs. custom (college-added) components:
 *
 *   - Defaults (`isDefault: true`): only `displayLabel` and `displayOrder`
 *     may be mutated. `componentKey`, `category`, `isRefundable`,
 *     `defaultOneTime`, and `applicableToYears` are fixed by the canonical
 *     spec. Defaults cannot be deleted.
 *   - Customs (`isDefault: false`): every field is mutable except
 *     `componentKey` (immutable once created to keep in-progress
 *     FeeStructureInstance references stable). Customs can be deleted.
 *
 * Also exposes `buildComponentsFromTemplate(collegeId, yearOfStudy)` — the
 * integration hook called by a future FeeStructureInstance create flow to
 * pre-populate zero-amount components from the canonical template filtered
 * to the given year. The caller persists the returned plain objects
 * alongside the FeeStructureInstance.
 *
 * Spec: .captain/specs/fee-configuration/spec.md §AC fee component template
 * Plan: .captain/specs/fee-configuration/plan.md §2.2, §1.9 (API)
 */

import {
  FeeComponentTemplate,
  IFeeComponentTemplate,
  FeeComponentTemplateCategory,
} from '../../models/finance/FeeComponentTemplate';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import { CANONICAL_FEE_COMPONENTS } from '../../scripts/seed-fee-component-template';

// Re-export canonical constant so downstream callers (admin UI) don't reach
// into a script module.
export { CANONICAL_FEE_COMPONENTS };

// Re-export the category enum so callers have a single import point.
export type { FeeComponentTemplateCategory } from '../../models/finance/FeeComponentTemplate';

// ── Types ─────────────────────────────────────────────────────────────

export interface ListComponentsOpts {
  /** Filter to a single category. */
  category?: FeeComponentTemplateCategory;
  /**
   * Include only components applicable to this year-of-study.
   * A component matches when `applicableToYears` is empty (= all years) OR
   * contains the given year.
   */
  applicableToYear?: number;
}

export interface CreateComponentInput {
  componentKey: string;
  displayLabel: string;
  category: FeeComponentTemplateCategory;
  isRefundable?: boolean;
  defaultOneTime?: boolean;
  applicableToYears?: number[];
  displayOrder?: number;
}

export interface UpdateComponentInput {
  displayLabel?: string;
  category?: FeeComponentTemplateCategory;
  isRefundable?: boolean;
  defaultOneTime?: boolean;
  applicableToYears?: number[];
  displayOrder?: number;
}

export interface BuiltComponent {
  componentKey: string;
  name: string;
  amount: number;
  isRefundable: boolean;
  oneTime: boolean;
  displayOrder: number;
  category: FeeComponentTemplateCategory;
}

// ── Constants ─────────────────────────────────────────────────────────

// lowercase snake_case; must start with a letter.
const COMPONENT_KEY_RE = /^[a-z][a-z0-9_]*$/;

// Fields that default components refuse to mutate.
const DEFAULT_LOCKED_FIELDS: ReadonlyArray<keyof UpdateComponentInput> = [
  'category',
  'isRefundable',
  'defaultOneTime',
  'applicableToYears',
];

const DEFAULT_IMMUTABLE_MSG =
  'Default components can only change displayLabel and displayOrder. ' +
  'componentKey/category/refundable/oneTime/applicableToYears are fixed by the canonical spec.';

const CUSTOM_KEY_IMMUTABLE_MSG =
  'componentKey is immutable once created. Delete the custom component and create a new one if you need a different key.';

// ── Reads ─────────────────────────────────────────────────────────────

/**
 * List template components for a college.
 * Sorted by `displayOrder` ascending (canonical ordering).
 */
export async function listComponents(
  collegeId: string,
  opts: ListComponentsOpts = {},
): Promise<IFeeComponentTemplate[]> {
  const filter: Record<string, unknown> = { collegeId };
  if (opts.category) filter.category = opts.category;
  if (typeof opts.applicableToYear === 'number') {
    // all-years (empty array) OR contains the year.
    filter.$or = [
      { applicableToYears: { $size: 0 } },
      { applicableToYears: opts.applicableToYear },
    ];
  }
  return FeeComponentTemplate.find(filter).sort({ displayOrder: 1 });
}

// ── Writes ────────────────────────────────────────────────────────────

export async function createComponent(
  collegeId: string,
  data: CreateComponentInput,
  performedBy: string,
): Promise<IFeeComponentTemplate> {
  if (!COMPONENT_KEY_RE.test(data.componentKey)) {
    throw new AppError(
      400,
      `Invalid componentKey "${data.componentKey}". Must be lowercase snake_case (e.g. "tuition_fee").`,
    );
  }

  // Friendly 409 pre-check (unique index is still the enforcement of record).
  const existing = await FeeComponentTemplate.findOne({
    collegeId,
    componentKey: data.componentKey,
  }).lean();
  if (existing) {
    throw new AppError(
      409,
      `Component with key "${data.componentKey}" already exists for this college.`,
    );
  }

  let { displayOrder } = data;
  if (typeof displayOrder !== 'number') {
    const max = await FeeComponentTemplate.findOne({ collegeId })
      .sort({ displayOrder: -1 })
      .select({ displayOrder: 1 })
      .lean();
    displayOrder = (max?.displayOrder ?? 0) + 10;
  }

  const doc = await FeeComponentTemplate.create({
    collegeId,
    componentKey: data.componentKey,
    displayLabel: data.displayLabel,
    category: data.category,
    isRefundable: data.isRefundable ?? false,
    defaultOneTime: data.defaultOneTime ?? false,
    applicableToYears: data.applicableToYears ?? [],
    displayOrder,
    isDefault: false,
  });

  await createAuditLog({
    collegeId,
    entityType: 'FeeComponentTemplate',
    entityId: String(doc._id),
    entityName: doc.displayLabel,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function updateComponent(
  collegeId: string,
  componentId: string,
  data: UpdateComponentInput,
  performedBy: string,
): Promise<IFeeComponentTemplate> {
  // Reject attempts to change componentKey via a smuggled field. It is not
  // part of UpdateComponentInput but callers can still send it at runtime.
  if (Object.prototype.hasOwnProperty.call(data, 'componentKey')) {
    throw new AppError(403, CUSTOM_KEY_IMMUTABLE_MSG);
  }

  const doc = await FeeComponentTemplate.findOne({
    _id: componentId,
    collegeId,
  });
  if (!doc) throw new AppError(404, 'Fee component template not found');

  if (doc.isDefault) {
    for (const key of DEFAULT_LOCKED_FIELDS) {
      if (data[key] !== undefined) {
        throw new AppError(403, DEFAULT_IMMUTABLE_MSG);
      }
    }
  }

  if (data.displayLabel !== undefined) doc.displayLabel = data.displayLabel;
  if (data.displayOrder !== undefined) doc.displayOrder = data.displayOrder;
  if (!doc.isDefault) {
    if (data.category !== undefined) doc.category = data.category;
    if (data.isRefundable !== undefined) doc.isRefundable = data.isRefundable;
    if (data.defaultOneTime !== undefined) doc.defaultOneTime = data.defaultOneTime;
    if (data.applicableToYears !== undefined) doc.applicableToYears = data.applicableToYears;
  }
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'FeeComponentTemplate',
    entityId: String(doc._id),
    entityName: doc.displayLabel,
    action: 'update',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function deleteComponent(
  collegeId: string,
  componentId: string,
  performedBy: string,
): Promise<void> {
  const doc = await FeeComponentTemplate.findOne({
    _id: componentId,
    collegeId,
  });
  if (!doc) throw new AppError(404, 'Fee component template not found');
  if (doc.isDefault) {
    throw new AppError(
      403,
      'Default components cannot be deleted. Set displayOrder to a high number to hide from the UI, or disable via a future feature flag.',
    );
  }

  const label = doc.displayLabel;
  const id = String(doc._id);
  await doc.deleteOne();

  await createAuditLog({
    collegeId,
    entityType: 'FeeComponentTemplate',
    entityId: id,
    entityName: label,
    action: 'delete',
    changes: [],
    performedBy,
  });
}

// ── Integration hook ──────────────────────────────────────────────────

/**
 * Build a zero-amount FeeComponent skeleton from the college's template,
 * filtered to the given year-of-study. Returns PLAIN objects (not Mongoose
 * docs); the caller persists them alongside the FeeStructureInstance it is
 * creating.
 */
export async function buildComponentsFromTemplate(
  collegeId: string,
  yearOfStudy: number,
): Promise<BuiltComponent[]> {
  const tmpl = await listComponents(collegeId, { applicableToYear: yearOfStudy });
  return tmpl.map((t) => ({
    componentKey: t.componentKey,
    name: t.displayLabel,
    amount: 0,
    isRefundable: t.isRefundable,
    oneTime: t.defaultOneTime,
    displayOrder: t.displayOrder,
    category: t.category,
  }));
}
