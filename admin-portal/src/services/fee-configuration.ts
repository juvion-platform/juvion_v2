import api from './api';

/**
 * Fee Configuration service (Task 13 UI client).
 *
 * Wraps the T12 HTTP API surface for fee pins, commitment sheets, and
 * programme transfers. Shapes mirror backend's `IFeePin` subdoc; server
 * responses may carry populated references (programme, branch, fee
 * structure instance) as nested objects — consumers should tolerate
 * either `.feeStructureInstanceId` being an ObjectId string or a
 * populated object with `_id` + display fields.
 */

const FINANCE = '/finance';

// ─── Types ───────────────────────────────────────────────

export type FeePinReason =
  | 'initial'
  | 'branch_change'
  | 'quota_change'
  | 'programme_transfer'
  | 'admin_override'
  | 'data_correction'
  | 'year_back_carryforward';

export type FeePinCommitmentSheetStatus = 'queued' | 'generated' | 'failed';

export interface PopulatedFeeStructureInstance {
  _id: string;
  name?: string;
  code?: string;
  version?: number;
  status?: string;
  totalAmount?: number;
  approvedAt?: string;
  yearOfStudy?: number;
  programmeId?: string | { _id: string; name?: string };
  branchId?: string | { _id: string; name?: string };
  academicYearId?: string | { _id: string; name?: string; label?: string; code?: string };
  quota?: string;
  category?: string;
}

export interface IFeePin {
  _id: string;
  yearOfStudy: number;
  feeStructureInstanceId: string | PopulatedFeeStructureInstance;
  pinnedAt: string;
  pinnedBy: string;
  reason: FeePinReason;
  remarks?: string;
  archivedAt?: string | null;
  archiveReason?: string;
  commitmentSheetDocumentId?: string | null;
  commitmentSheetStatus?: FeePinCommitmentSheetStatus;
  staleSince?: string | null;
}

export interface RePinInput {
  yearOfStudy: number;
  targetFeeStructureInstanceId: string;
  reason: FeePinReason;
  remarks?: string;
}

export interface TransferProgrammeInput {
  newProgrammeId: string;
  newBranchId?: string;
  newRegulationId?: string;
  effectiveYearOfStudy: number;
  academicYearId: string;
  reason: string;
}

// ─── Pins ────────────────────────────────────────────────

export const getStudentPins = (studentId: string): Promise<{ pins: IFeePin[] }> =>
  api.get(`${FINANCE}/students/${studentId}/pins`).then((r) => r.data);

export const rePinStudent = (
  studentId: string,
  data: RePinInput,
): Promise<{ pin: IFeePin }> =>
  api.post(`${FINANCE}/students/${studentId}/pins/re-pin`, data).then((r) => r.data);

export const regenerateCommitmentSheet = (
  studentId: string,
  data: { pinId?: string } = {},
): Promise<{ documentId: string } | { jobId: string; status: string }> =>
  api
    .post(`${FINANCE}/students/${studentId}/commitment-sheet/regenerate`, data)
    .then((r) => r.data);

export const transferProgramme = (
  studentId: string,
  data: TransferProgrammeInput,
): Promise<{ oldPin: IFeePin | null; newPin: IFeePin }> =>
  api
    .post(`${FINANCE}/students/${studentId}/transfer-programme`, data)
    .then((r) => r.data);

// ─── Fee Structure Instances (for re-pin target dropdown) ────────────

export interface FeeStructureInstanceListParams {
  programmeId?: string;
  branchId?: string;
  academicYearId?: string;
  quota?: string;
  category?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const listFeeStructureInstances = (
  params: FeeStructureInstanceListParams = {},
): Promise<{ items: PopulatedFeeStructureInstance[]; total?: number; page?: number; pages?: number }> =>
  api
    .get(`${FINANCE}/fee-structure-instances`, { params })
    .then((r) => r.data);

// ─── Preview match ───────────────────────────────────────

/**
 * Read-only preview that resolves the FeeStructureInstance which would
 * be pinned for a given raw combination. Powers the live "matching fee
 * structure" strip on the StudentFormPage Academic Details tab.
 *
 * Server resolves `academicYearId` from the college's current AY when
 * one is not passed.
 */
export interface PreviewMatchInput {
  programmeId: string;
  branchId?: string | null;
  quota?: string | null;
  category?: string | null;
  yearOfStudy?: number;
  academicYearId?: string;
}

export interface PreviewMatchResult {
  matched: boolean;
  fsi: PopulatedFeeStructureInstance | null;
  academicYearId: string | null;
  reason?: 'no-academic-year' | 'no-matching-fee-structure';
}

export const previewMatchingFeeStructure = (
  input: PreviewMatchInput,
): Promise<PreviewMatchResult> => {
  // Strip empty / nullish so they don't go on the wire — the backend
  // treats `branchId=` (empty string) the same as missing, but cleaner
  // to omit the param entirely.
  const params: Record<string, string | number> = {
    programmeId: input.programmeId,
  };
  if (input.branchId) params.branchId = input.branchId;
  if (input.quota) params.quota = input.quota;
  if (input.category) params.category = input.category;
  if (input.yearOfStudy) params.yearOfStudy = input.yearOfStudy;
  if (input.academicYearId) params.academicYearId = input.academicYearId;
  return api
    .get(`${FINANCE}/fee-structure-instances/preview-match`, { params })
    .then((r) => r.data);
};

// ─── Fee Components (per-FSI breakdown) ─────────────────

export type FeeComponentType =
  | 'tuition'
  | 'hostel'
  | 'transport'
  | 'lab'
  | 'exam'
  | 'library'
  | 'development'
  | 'caution_deposit'
  | 'other';

export interface IFeeComponent {
  _id: string;
  feeStructureInstanceId: string;
  name: string;
  amount: number;
  isRefundable: boolean;
  componentType: FeeComponentType;
  isConditional: boolean;
  displayOrder?: number;
}

export const listFeeComponents = (
  feeStructureInstanceId: string,
  limit = 50,
): Promise<{ items: IFeeComponent[]; total?: number; page?: number; pages?: number }> =>
  api
    .get(`${FINANCE}/fee-components`, {
      params: { feeStructureInstanceId, limit },
    })
    .then((r) => r.data);

// ─── Component Template ──────────────────────────────────

export const getComponentTemplate = () =>
  api.get(`${FINANCE}/component-template`).then((r) => r.data);

// ─── FSI authoring (Fix 1: create / edit / lifecycle) ────────────────

export interface CreateFeeStructureInstanceInput {
  academicYearId: string;
  programmeId: string;
  branchId?: string;
  category?: string;
  quota?: string;
  /** Optional year-of-study (1–8). Omit for "any year" (wildcard). */
  yearOfStudy?: number;
  totalAmount?: number;
}

/** PATCH edit of a draft/revision_required FSI. Nullable axes clear to wildcard. */
export interface UpdateFeeStructureInstanceInput {
  academicYearId?: string;
  programmeId?: string;
  branchId?: string | null;
  category?: string | null;
  quota?: string | null;
  yearOfStudy?: number | null;
  totalAmount?: number;
}

export const getFeeStructureInstance = (id: string): Promise<PopulatedFeeStructureInstance> =>
  api.get(`${FINANCE}/fee-structure-instances/${id}`).then((r) => r.data);

export const createFeeStructureInstance = (
  data: CreateFeeStructureInstanceInput,
): Promise<PopulatedFeeStructureInstance> =>
  api.post(`${FINANCE}/fee-structure-instances`, data).then((r) => r.data);

export const updateFeeStructureInstance = (
  id: string,
  data: UpdateFeeStructureInstanceInput,
): Promise<PopulatedFeeStructureInstance> =>
  api.patch(`${FINANCE}/fee-structure-instances/${id}`, data).then((r) => r.data);

export const deleteFeeStructureInstance = (id: string): Promise<{ deleted: boolean }> =>
  api.delete(`${FINANCE}/fee-structure-instances/${id}`).then((r) => r.data);

// Lifecycle transitions. All require finance:update on the backend.
export const submitFeeStructureInstance = (id: string): Promise<PopulatedFeeStructureInstance> =>
  api.post(`${FINANCE}/fee-structure-instances/${id}/submit`).then((r) => r.data);

export const approveFeeStructureInstance = (id: string): Promise<PopulatedFeeStructureInstance> =>
  api.post(`${FINANCE}/fee-structure-instances/${id}/approve`).then((r) => r.data);

export const activateFeeStructureInstance = (id: string): Promise<PopulatedFeeStructureInstance> =>
  api.post(`${FINANCE}/fee-structure-instances/${id}/activate`).then((r) => r.data);

export const rejectFeeStructureInstance = (
  id: string,
  comments: string,
): Promise<PopulatedFeeStructureInstance> =>
  api.post(`${FINANCE}/fee-structure-instances/${id}/reject`, { comments }).then((r) => r.data);

export const archiveFeeStructureInstance = (id: string): Promise<PopulatedFeeStructureInstance> =>
  api.post(`${FINANCE}/fee-structure-instances/${id}/archive`).then((r) => r.data);

// ─── Fee Component authoring ─────────────────────────────────────────

export interface CreateFeeComponentInput {
  feeStructureInstanceId: string;
  name: string;
  amount: number;
  componentType: FeeComponentType;
  isRefundable?: boolean;
  isConditional?: boolean;
  displayOrder?: number;
}

export const createFeeComponent = (data: CreateFeeComponentInput): Promise<IFeeComponent> =>
  api.post(`${FINANCE}/fee-components`, data).then((r) => r.data);

export const updateFeeComponent = (
  id: string,
  data: Partial<Omit<CreateFeeComponentInput, 'feeStructureInstanceId'>>,
): Promise<IFeeComponent> =>
  api.put(`${FINANCE}/fee-components/${id}`, data).then((r) => r.data);

export const deleteFeeComponent = (id: string): Promise<{ message?: string } | IFeeComponent> =>
  api.delete(`${FINANCE}/fee-components/${id}`).then((r) => r.data);
