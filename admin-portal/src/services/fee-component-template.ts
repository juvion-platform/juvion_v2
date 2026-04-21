import api from './api';

/**
 * Fee Component Template service (Task 14 UI client).
 *
 * Wraps the T12 HTTP API surface for the college's fee component catalog.
 * Shape mirrors backend's `IFeeComponentTemplate` model. The 33 canonical
 * default components ship with every college (see T2 seed); colleges may
 * add/edit/delete custom components but cannot remove defaults.
 */

const FINANCE = '/finance';

// ─── Types ───────────────────────────────────────────────

export type FeeComponentTemplateCategory =
  | 'academic'
  | 'admission_oneoff'
  | 'lab'
  | 'infrastructure'
  | 'student_life'
  | 'regulatory'
  | 'caution'
  | 'conditional';

export interface FeeComponentTemplateDoc {
  _id: string;
  collegeId: string;
  componentKey: string;
  displayLabel: string;
  category: FeeComponentTemplateCategory;
  isRefundable: boolean;
  defaultOneTime: boolean;
  applicableToYears: number[];
  displayOrder: number;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListComponentsParams {
  category?: FeeComponentTemplateCategory;
  applicableToYear?: number;
  /**
   * Optional — server derives collegeId from the auth token / x-college-id
   * header. Included here for operational tools that pass an explicit scope.
   */
  collegeId?: string;
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

// ─── Constants ───────────────────────────────────────────

export const COMPONENT_KEY_REGEX = /^[a-z][a-z0-9_]*$/;

export const CATEGORY_LABELS: Record<FeeComponentTemplateCategory, string> = {
  academic: 'Academic',
  admission_oneoff: 'Admission (One-off)',
  lab: 'Lab & Practical',
  infrastructure: 'Infrastructure',
  student_life: 'Student Life',
  regulatory: 'Regulatory',
  caution: 'Caution / Deposits',
  conditional: 'Conditional',
};

export const CATEGORY_ORDER: FeeComponentTemplateCategory[] = [
  'academic',
  'admission_oneoff',
  'lab',
  'infrastructure',
  'student_life',
  'regulatory',
  'caution',
  'conditional',
];

// ─── API ─────────────────────────────────────────────────

/**
 * GET /api/finance/component-template
 *
 * The T12 endpoint returns either a bare array of components or an object
 * shape `{ items: [...] }`. We normalize here so the UI only ever deals
 * with `FeeComponentTemplateDoc[]`.
 */
export async function listComponents(
  params: ListComponentsParams = {},
): Promise<FeeComponentTemplateDoc[]> {
  const res = await api.get(`${FINANCE}/component-template`, { params });
  const data = res.data;
  if (Array.isArray(data)) return data as FeeComponentTemplateDoc[];
  if (data && Array.isArray(data.items)) return data.items as FeeComponentTemplateDoc[];
  if (data && Array.isArray(data.components)) return data.components as FeeComponentTemplateDoc[];
  return [];
}

/** POST /api/finance/component-template/components — create a custom component. */
export async function createComponent(
  data: CreateComponentInput,
): Promise<FeeComponentTemplateDoc> {
  const res = await api.post(`${FINANCE}/component-template/components`, data);
  // Tolerate either `{ component }` or a bare doc.
  return (res.data?.component ?? res.data) as FeeComponentTemplateDoc;
}

/** PUT /api/finance/component-template/components/:componentId */
export async function updateComponent(
  componentId: string,
  data: UpdateComponentInput,
): Promise<FeeComponentTemplateDoc> {
  const res = await api.put(
    `${FINANCE}/component-template/components/${componentId}`,
    data,
  );
  return (res.data?.component ?? res.data) as FeeComponentTemplateDoc;
}

/** DELETE /api/finance/component-template/components/:componentId */
export async function deleteComponent(componentId: string): Promise<void> {
  await api.delete(`${FINANCE}/component-template/components/${componentId}`);
}
