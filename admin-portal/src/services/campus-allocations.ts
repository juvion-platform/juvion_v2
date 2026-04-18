/**
 * Client helpers for the optional-hostel-transport-allotment endpoints
 * (tasks T8–T10). Uses the `/campus` route prefix mounted under `/api`.
 */

import api from './api';

const BASE = '/campus';

// ─── Admin: Hostel (T8) ────────────────────────────────────

export const proposeHostelAllocation = (data: {
  studentId: string;
  roomId: string;
  bedId?: string;
  academicYearId: string;
  forceWaitlist?: boolean;
}) => api.post(`${BASE}/hostel/allocations/propose`, data).then(r => r.data);

export const withdrawHostelAllocation = (id: string, reason: string) =>
  api.post(`${BASE}/hostel/allocations/${id}/withdraw`, { reason }).then(r => r.data);

export const promoteHostelAllocation = (id: string) =>
  api.post(`${BASE}/hostel/allocations/${id}/promote`, {}).then(r => r.data);

export const approveVacateHostelAllocation = (id: string, clearanceNotes?: string) =>
  api.post(`${BASE}/hostel/allocations/${id}/approve-vacate`, { clearanceNotes }).then(r => r.data);

export const rejectVacateHostelAllocation = (id: string, reason: string) =>
  api.post(`${BASE}/hostel/allocations/${id}/reject-vacate`, { reason }).then(r => r.data);

// ─── Admin: Transport (T9) ─────────────────────────────────

export const proposeTransportAllocation = (data: {
  studentId: string;
  routeId: string;
  stopName: string;
  stopId?: string;
  boardingPoint?: string;
  academicYearId: string;
  forceWaitlist?: boolean;
}) => api.post(`${BASE}/transport/allocations/propose`, data).then(r => r.data);

export const withdrawTransportAllocation = (id: string, reason: string) =>
  api.post(`${BASE}/transport/allocations/${id}/withdraw`, { reason }).then(r => r.data);

export const promoteTransportAllocation = (id: string) =>
  api.post(`${BASE}/transport/allocations/${id}/promote`, {}).then(r => r.data);

export const approveCancelTransportAllocation = (id: string, clearanceNotes?: string) =>
  api.post(`${BASE}/transport/allocations/${id}/approve-vacate`, { clearanceNotes }).then(r => r.data);

export const rejectCancelTransportAllocation = (id: string, reason: string) =>
  api.post(`${BASE}/transport/allocations/${id}/reject-vacate`, { reason }).then(r => r.data);

// ─── Student actions (T10) ─────────────────────────────────

export const acceptHostelAllocation = (id: string) =>
  api.post(`${BASE}/hostel/allocations/${id}/accept`, {}).then(r => r.data);

export const declineHostelAllocation = (id: string, reason?: string) =>
  api.post(`${BASE}/hostel/allocations/${id}/decline`, { reason }).then(r => r.data);

export const requestVacateHostelAllocation = (id: string, reason?: string) =>
  api.post(`${BASE}/hostel/allocations/${id}/request-vacate`, { reason }).then(r => r.data);

export const acceptTransportAllocation = (id: string) =>
  api.post(`${BASE}/transport/allocations/${id}/accept`, {}).then(r => r.data);

export const declineTransportAllocation = (id: string, reason?: string) =>
  api.post(`${BASE}/transport/allocations/${id}/decline`, { reason }).then(r => r.data);

export const requestCancelTransportAllocation = (id: string, reason?: string) =>
  api.post(`${BASE}/transport/allocations/${id}/request-vacate`, { reason }).then(r => r.data);

// ─── Student: my allocations ───────────────────────────────

export interface MyAllocationsResponse {
  items: Array<{
    _id: string;
    status: string;
    roomId?: string;
    routeId?: string;
    stopName?: string;
    academicYearId: string;
    proposedAt?: string;
    respondedAt?: string;
    expiresAt?: string;
    createdAt: string;
  }>;
  pendingCount: number;
  activeCount: number;
}

export const listMyHostelAllocations = (): Promise<MyAllocationsResponse> =>
  api.get(`${BASE}/hostel/allocations/mine`).then(r => r.data);

export const listMyTransportAllocations = (): Promise<MyAllocationsResponse> =>
  api.get(`${BASE}/transport/allocations/mine`).then(r => r.data);
