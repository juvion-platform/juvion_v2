import api from './api';

// ── Types — mirror backend `fee-analytics-service.ts` ────────────────

export interface DashboardFilters {
  from: string; // ISO date (YYYY-MM-DD)
  to: string;
  programmeIds?: string[];
  branchIds?: string[];
  batchIds?: string[];
  academicYearId?: string;
}

export interface FunnelByStage {
  stage_1: number;
  stage_2: number;
  stage_3: number;
  stage_4: number;
  welfare_referred: number;
}

export type PaymentModeKey =
  | 'cash'
  | 'upi'
  | 'neft'
  | 'cheque'
  | 'online'
  | 'card'
  | 'other';

export type PaymentModeBreakdown = Record<PaymentModeKey, number>;

export interface DashboardV1 {
  totalOutstanding: number;
  collectedInRange: number;
  collectionRatePercent: number;
  overdueStudentsCount: number;
  overdueAmount: number;
  funnelByStage: FunnelByStage;
  collectionTimeSeries: Array<{ bucket: string; amount: number }>;
  dueVsCollectedByMonth: Array<{ month: string; due: number; collected: number }>;
  paymentModeBreakdown: PaymentModeBreakdown;
  dueByProgramme: Array<{
    programmeId: string;
    programmeName: string;
    due: number;
    collected: number;
  }>;
}

export interface DefaulterListQuery {
  limit?: number;
  offset?: number;
  sort?: 'overdueAmount' | 'daysOverdue';
}

export interface DefaulterListItem {
  studentId: string;
  rollNumber: string;
  name: string;
  programmeName: string;
  overdueAmount: number;
  daysOverdue: number;
  escalationStage: string;
  autoEscalationPaused?: string | null; // ISO from server
}

// ── Client ───────────────────────────────────────────────────────────

const BASE = '/finance/analytics';

export const getDashboard = (filters: DashboardFilters): Promise<DashboardV1> =>
  api.get<DashboardV1>(`${BASE}/dashboard`, { params: filters }).then((r) => r.data);

export const getDefaulters = (
  query: DefaulterListQuery = {},
): Promise<{ items: DefaulterListItem[]; total: number }> =>
  api
    .get<{ items: DefaulterListItem[]; total: number }>(`${BASE}/defaulters`, { params: query })
    .then((r) => r.data);
