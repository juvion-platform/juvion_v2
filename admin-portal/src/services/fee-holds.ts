/**
 * fee-holds — HTTP client for the Financial Holds approval workflow
 * (fee-collection-analytics-and-alerts / Task 10).
 *
 * Endpoints (T8):
 *   - GET  /api/finance/holds
 *   - POST /api/finance/holds/:id/activate
 *   - POST /api/finance/holds/:id/waive
 *
 * Principal role gate is enforced server-side (`finance:update`).
 * The UI hides mutation buttons via `useAuthStore(s => s.hasPermission(...))`
 * for a consistent read-only experience on non-approver roles.
 */
import api from './api';

export type HoldStatus = 'pending_approval' | 'active' | 'released';

export type HoldType =
  | 'exam_debarment'
  | 'hostel_restriction'
  | 'transcript_hold'
  | 'full_clearance_block';

export interface FinancialHold {
  _id: string;
  collegeId: string;
  studentId: string;
  defaulterRecordId?: string;
  holdType: HoldType;
  holdStatus: HoldStatus;
  effectiveDate: string;
  approvedBy?: string;
  releasedBy?: string;
  releaseDate?: string;
  releaseReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface ListHoldsQuery {
  status?: HoldStatus;
  studentId?: string;
  limit?: number;
  offset?: number;
}

export interface ListHoldsResponse {
  items: FinancialHold[];
  total: number;
}

export const listHolds = (query: ListHoldsQuery = {}) =>
  api
    .get<ListHoldsResponse>('/finance/holds', { params: query })
    .then(r => r.data);

export const activateHold = (holdId: string) =>
  api.post<FinancialHold>(`/finance/holds/${holdId}/activate`).then(r => r.data);

export const waiveHold = (holdId: string, reason: string) =>
  api
    .post<FinancialHold>(`/finance/holds/${holdId}/waive`, { reason })
    .then(r => r.data);
