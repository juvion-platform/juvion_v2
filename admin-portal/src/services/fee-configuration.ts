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
  programmeId?: string | { _id: string; name?: string };
  branchId?: string | { _id: string; name?: string };
  academicYearId?: string | { _id: string; name?: string };
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

// ─── Component Template ──────────────────────────────────

export const getComponentTemplate = () =>
  api.get(`${FINANCE}/component-template`).then((r) => r.data);
