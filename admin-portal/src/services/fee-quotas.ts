/**
 * fee-quotas — admin-portal service for the per-college FeeQuota
 * catalog (convener, management, nri, spot, lateral, …). Drives the
 * Quota dropdown on FeeStructure + Student forms.
 *
 * The backend stores `Student.quota` and `FeeStructureInstance.quota`
 * as the string `code` (not an ObjectId), so the dropdown labels
 * with `name` but submits `code`. Do not "normalize" the API to
 * return ObjectId references — fee-pin-service matches
 * `student.quota` to `FeeStructureInstance.quota` by string equality
 * and that contract must not break.
 */

import api from './api';

const BASE = '/finance';

export type FeeQuotaStatus = 'active' | 'inactive';

export interface FeeQuotaDoc {
  _id: string;
  collegeId: string;
  code: string;
  name: string;
  description?: string;
  status: FeeQuotaStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface FeeQuotaListResult {
  items: FeeQuotaDoc[];
  total: number;
  page: number;
  pages: number;
}

export interface CreateFeeQuotaInput {
  code: string;
  name: string;
  description?: string;
  status?: FeeQuotaStatus;
}

export type UpdateFeeQuotaInput = Partial<CreateFeeQuotaInput>;

export const listFeeQuotas = (
  page = 1,
  limit = 20,
  status?: FeeQuotaStatus,
): Promise<FeeQuotaListResult> =>
  api
    .get(`${BASE}/fee-quotas`, { params: { page, limit, status } })
    .then((r) => r.data);

export const getFeeQuota = (id: string): Promise<FeeQuotaDoc> =>
  api.get(`${BASE}/fee-quotas/${id}`).then((r) => r.data);

export const createFeeQuota = (
  data: CreateFeeQuotaInput,
): Promise<FeeQuotaDoc> =>
  api.post(`${BASE}/fee-quotas`, data).then((r) => r.data);

export const updateFeeQuota = (
  id: string,
  data: UpdateFeeQuotaInput,
): Promise<FeeQuotaDoc> =>
  api.patch(`${BASE}/fee-quotas/${id}`, data).then((r) => r.data);

export const deleteFeeQuota = (id: string): Promise<void> =>
  api.delete(`${BASE}/fee-quotas/${id}`).then((r) => r.data);
