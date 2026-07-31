/**
 * pin-coverage — client for the fee-pin coverage report and the bulk-pin
 * action that clears its backlog.
 *
 * Backend: finance/fee-pin-audit-service.ts (GET /finance/pin-audit/coverage)
 * and finance/bulk-pin-service.ts (POST /finance/students/bulk-pin).
 */
import api from './api';

export type CoverageReason =
  | 'no-matching-structure'
  | 'never-pinned'
  | 'year-unresolvable'
  | 'no-fee-responsible-guardian';

/** Each reason is a different job with a different owner. */
export const COVERAGE_REASON_LABEL: Record<CoverageReason, string> = {
  'no-matching-structure': 'No fee structure published',
  'never-pinned': 'Never pinned',
  'year-unresolvable': 'Year of study unknown',
  'no-fee-responsible-guardian': 'No fee-responsible guardian',
};

export const COVERAGE_REASON_HINT: Record<CoverageReason, string> = {
  'no-matching-structure':
    'Finance must publish a fee structure for these axes before they can be pinned.',
  'never-pinned':
    'A matching structure exists — these can be pinned now.',
  'year-unresolvable':
    'These students have no batch, so their current year cannot be derived. Assign a batch.',
  'no-fee-responsible-guardian':
    'Pinned, but payment will be refused until a fee-responsible guardian is set.',
};

export interface CoverageStudent {
  studentId: string;
  name: string;
  programmeId: string | null;
  rollNumber?: string;
  programmeCode?: string;
  branchCode?: string;
  quota?: string;
  category?: string;
  yearOfStudy: number;
  reason: CoverageReason;
}

export interface CoverageGroup {
  reason: CoverageReason;
  programmeCode?: string;
  branchCode?: string;
  quota?: string;
  category?: string;
  yearOfStudy: number;
  count: number;
}

export interface CoverageReport {
  collegeId: string;
  totalActiveStudents: number;
  studentsWithActivePinForCurrentYear: number;
  coveragePercent: number;
  counts: Record<CoverageReason, number>;
  groups: CoverageGroup[];
  students: CoverageStudent[];
  page: number;
  limit: number;
  total: number;
}

export const getPinCoverage = (params: {
  page?: number;
  limit?: number;
  reason?: CoverageReason;
}): Promise<CoverageReport> =>
  api.get('/finance/pin-audit/coverage', { params }).then((r) => r.data);

export interface BulkPinRow {
  studentId: string;
  name: string;
  rollNumber?: string;
  yearOfStudy: number;
  outcome: 'pinned' | 'already-pinned' | 'no-match' | 'skipped' | 'error';
  message?: string;
  totalAmount?: number;
  yearAssumed: boolean;
}

export interface BulkPinResult {
  dryRun: boolean;
  considered: number;
  pinned: number;
  alreadyPinned: number;
  noMatch: number;
  skipped: number;
  errors: number;
  totalPinnedAmount: number;
  capped: boolean;
  rows: BulkPinRow[];
}

export interface BulkPinRequest {
  studentIds?: string[];
  filter?: {
    programmeId?: string;
    branchId?: string;
    quota?: string;
    category?: string;
  };
  academicYearId?: string;
  dryRun?: boolean;
}

export const bulkPin = (body: BulkPinRequest): Promise<BulkPinResult> =>
  api.post('/finance/students/bulk-pin', body).then((r) => r.data);
