/**
 * fee-categories — admin-portal service for the per-college FeeCategory
 * catalog (OC, OBC, SC, ST, NRI, …). Drives the Category dropdown on
 * FeeStructure forms.
 *
 * The backend stores `FeeStructure.category` as the string `code` (not an
 * ObjectId), so the dropdown labels with `name` but submits `code`. Do not
 * "normalize" the API to return ObjectId references — fee-pin-service
 * matches `student.category` to `FeeStructure.category` by string equality
 * and that contract must not break.
 */

import api from './api';

const BASE = '/finance';

export type FeeCategoryStatus = 'active' | 'inactive';

export interface FeeCategoryDoc {
  _id: string;
  collegeId: string;
  code: string;
  name: string;
  description?: string;
  status: FeeCategoryStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface FeeCategoryListResult {
  items: FeeCategoryDoc[];
  total: number;
  page: number;
  pages: number;
}

export interface CreateFeeCategoryInput {
  code: string;
  name: string;
  description?: string;
  status?: FeeCategoryStatus;
}

export type UpdateFeeCategoryInput = Partial<CreateFeeCategoryInput>;

export const listFeeCategories = (
  page = 1,
  limit = 20,
  status?: FeeCategoryStatus,
): Promise<FeeCategoryListResult> =>
  api
    .get(`${BASE}/fee-categories`, { params: { page, limit, status } })
    .then((r) => r.data);

export const getFeeCategory = (id: string): Promise<FeeCategoryDoc> =>
  api.get(`${BASE}/fee-categories/${id}`).then((r) => r.data);

export const createFeeCategory = (
  data: CreateFeeCategoryInput,
): Promise<FeeCategoryDoc> =>
  api.post(`${BASE}/fee-categories`, data).then((r) => r.data);

export const updateFeeCategory = (
  id: string,
  data: UpdateFeeCategoryInput,
): Promise<FeeCategoryDoc> =>
  api.patch(`${BASE}/fee-categories/${id}`, data).then((r) => r.data);

export const deleteFeeCategory = (id: string): Promise<void> =>
  api.delete(`${BASE}/fee-categories/${id}`).then((r) => r.data);
