/**
 * notices — admin-portal client for Juvi notices (/api/juvi-app/admin/notices).
 * Spec: docs/superpowers/specs/2026-09-26-juvi-notices-design.md §7.2, §8.
 * ERP error shape: `{ error }`, or `{ error: 'Validation failed', details }`;
 * some 409s add `detail` (lib/notices.ts reads both).
 */
import api from './api';
import type { Paginated } from './juvi-app';

const BASE = '/juvi-app/admin/notices';

export type AudienceRuleKind = 'all' | 'role' | 'department' | 'programme' | 'batch' | 'section' | 'course_offering' | 'hostel_block' | 'custom';
export type NoticePriority = 'routine' | 'important' | 'urgent';
export type NoticePurpose = 'standard' | 'welcome';
export type NoticeStatus = 'publishing' | 'published' | 'archived';
export type DeliveryState = 'delivering' | 'delivered' | 'failed';
export type ReachState = 'acknowledged' | 'seen' | 'not_seen' | 'not_on_juvi';

/** `ids` are ObjectIds, except for `role` (student | faculty | staff | hod, or a persona code). */
export interface AudienceRule { kind: AudienceRuleKind; ids: string[]; departmentId?: string }
export interface NoticeAttachment { key: string; name: string; mime: string; size: number }
export interface Reminders { used: number; max: number; lastAt: string | null }
export interface DeliveryView { state: DeliveryState; attempts: number; lastError: string | null; updatedAt: string | null }

export interface NoticeRow {
  id: string; title: string; office: string; audienceLine: string; status: NoticeStatus; purpose: NoticePurpose; delivery: DeliveryView;
  publishedAt: string | null; createdAt: string; ackRequired: boolean; deadline: string | null; deadlineState: 'none' | 'open' | 'passed';
  counts: { audience: number; onJuvi: number }; acknowledged: number; seen: number; reminders: Reminders; isMine: boolean;
}
export interface NoticeDetail extends NoticeRow {
  body: string; attachments: NoticeAttachment[]; audience: { rules: AudienceRule[]; line: string };
  ackCommentAllowed: boolean; priority: NoticePriority; archivedAt: string | null; canManage: boolean;
}
export interface NoticeListQuery { page: number; limit: number; status?: NoticeStatus; purpose?: NoticePurpose; office?: string; q?: string }

export interface TargetOption { id: string; label: string }
export interface NoticeTargets {
  office: string; offices: string[]; isAdmin: boolean; timezone: string;
  kinds: AudienceRuleKind[]; roles: string[];
  departments: TargetOption[]; programmes: TargetOption[]; batches: TargetOption[]; sections: TargetOption[];
  courseOfferings: TargetOption[]; hostelBlocks: TargetOption[];
}
export interface PersonOption { id: string; label: string; hint: string }
export interface AudiencePreview { total: number; onJuvi: number; notOnJuvi: number; groups: { label: string; total: number; onJuvi: number }[]; line: string }

export interface PublishNoticeInput {
  title: string; body: string; attachments: NoticeAttachment[]; audience: { rules: AudienceRule[] };
  ackRequired: boolean; ackDeadline?: string | null; ackCommentAllowed: boolean;
  priority: NoticePriority; purpose: NoticePurpose; office?: string;
}

export interface ReachGroup { label: string; total: number; acknowledged: number; seen: number; notSeen: number; notOnJuvi: number }
export interface ReachPerson { name: string; identifier: string | null; group: string; at: string | null }
export interface Reach {
  noticeId: string; title: string; status: NoticeStatus; ackRequired: boolean; deadline: string | null; publishedAt: string | null;
  audience: number; acknowledged: number; seen: number; notSeen: number; notOnJuvi: number; dismissed: number; late: number;
  reminders: Reminders; sparkline: number[]; groups: ReachGroup[];
  lateAcks: ReachPerson[];
  comments: (ReachPerson & { comment: string; late: boolean })[];
  addedLater: { total: number; acknowledged: number; seen: number; items: (ReachPerson & { state: ReachState })[] };
  asOf: string;
}
export interface PendingPerson { name: string; identifier: string | null; group: string; state: 'seen' | 'not_seen' | 'not_on_juvi'; lastSeenInApp: string | null }
export interface PendingQuery { group?: string; q?: string; cursor?: string; limit?: number }
export interface PendingPage { items: PendingPerson[]; total: number; groups: { label: string; count: number }[]; nextCursor: string | null }

export interface AuditChange { field: string; displayName?: string; oldValue: unknown; newValue: unknown }
export interface AuditEntry { action: string; entityType: string; performedBy: string; at: string; changes: AuditChange[] }
export interface DeadEvent { id: string; type: string; noticeId: string | null; attempts: number; lastError: string | null; createdAt: string; updatedAt: string | null }

const clean = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>;

export const listNotices = (q: NoticeListQuery): Promise<Paginated<NoticeRow>> => api.get(BASE, { params: clean(q) }).then((r) => r.data);
export const getNotice = (id: string): Promise<NoticeDetail> => api.get(`${BASE}/${id}`).then((r) => r.data);
export const getNoticeTargets = (): Promise<NoticeTargets> => api.get(`${BASE}/targets`).then((r) => r.data);
export const searchNoticePeople = (q: string): Promise<{ items: PersonOption[] }> =>
  api.get(`${BASE}/targets/people`, { params: clean({ q }) }).then((r) => r.data);
export const previewAudience = (rules: AudienceRule[], office?: string): Promise<AudiencePreview> =>
  api.post(`${BASE}/audience-preview`, { rules, ...(office ? { office } : {}) }).then((r) => r.data);

export async function uploadNoticeAttachment(file: File, onProgress?: (pct: number) => void): Promise<NoticeAttachment> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.post(`${BASE}/attachments`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
    },
  });
  return res.data;
}

export const publishNotice = (input: PublishNoticeInput): Promise<NoticeDetail> => api.post(BASE, input).then((r) => r.data);

export const getReach = (id: string): Promise<Reach> => api.get(`${BASE}/${id}/reach`).then((r) => r.data);
export const getPending = (id: string, q: PendingQuery = {}): Promise<PendingPage> =>
  api.get(`${BASE}/${id}/reach/pending`, { params: clean(q) }).then((r) => r.data);

/** Every pending member, in pages of 200, for "Copy pending list". */
export async function getAllPending(id: string, q: Pick<PendingQuery, 'group' | 'q'> = {}): Promise<PendingPerson[]> {
  const out: PendingPerson[] = [];
  let cursor: string | undefined;
  do {
    const page = await getPending(id, { ...q, cursor, limit: 200 });
    out.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return out;
}

export async function downloadReachCsv(id: string): Promise<{ blob: Blob; filename: string }> {
  const res = await api.get(`${BASE}/${id}/reach.csv`, { responseType: 'blob' });
  const match = /filename="([^"]+)"/.exec(String(res.headers['content-disposition'] ?? ''));
  return { blob: res.data as Blob, filename: match?.[1] ?? 'notice-reach.csv' };
}

export const getNoticeAudit = (id: string): Promise<{ items: AuditEntry[] }> => api.get(`${BASE}/${id}/audit`).then((r) => r.data);
export const remindNotice = (id: string): Promise<{ reminders: Reminders }> => api.post(`${BASE}/${id}/remind`).then((r) => r.data);
export const archiveNotice = (id: string): Promise<{ status: 'archived'; archivedAt: string }> => api.post(`${BASE}/${id}/archive`).then((r) => r.data);
export const retryNoticeDelivery = (id: string): Promise<DeliveryView> => api.post(`${BASE}/${id}/retry-delivery`).then((r) => r.data);
export const listDeadEvents = (page = 1, limit = 20): Promise<Paginated<DeadEvent>> =>
  api.get(`${BASE}/dead-events`, { params: { page, limit } }).then((r) => r.data);
