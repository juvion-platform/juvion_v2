/**
 * juvi-app — admin-portal client for the Juvi mobile-app administration API
 * (/api/juvi-app/admin). Spec: docs/superpowers/specs/2026-09-23-juvi-foundation-design.md §12.
 */
import api from './api';

const BASE = '/juvi-app/admin';

export type AccountKind = 'student' | 'faculty' | 'staff';
export type AccountStatus = 'onboarding' | 'active' | 'exiting' | 'deactivated';
export type RunStatus = 'queued' | 'running' | 'completed' | 'partial' | 'failed';

export interface JuviSettings {
  enabled: boolean; paused: boolean; pausedMessage?: string; accentColor?: string;
  supportContact?: { name: string; phone?: string; email?: string };
  quietHoursDefault: { start: string; end: string };
  minAppVersion?: { android?: string; ios?: string };
  timezone: string; featureFlags: { languageRoadmap: boolean };
}
export interface ReconcileSummary {
  at: string; durationMs: number; skipped: boolean;
  channels: { created: number; archived: number; unarchived: number; total: number };
  memberships: { added: number; removed: number; roleChanged: number }; errors: number;
}
export interface AdminSettingsView { juvi: JuviSettings; college: { name: string; code: string }; lastReconcile: ReconcileSummary | null }
export type JuviSettingsPatch = Partial<Omit<JuviSettings, 'accentColor' | 'supportContact'>> & {
  accentColor?: string | null;
  supportContact?: JuviSettings['supportContact'] | null;
};

export interface ProvisioningRun {
  _id: string; status: RunStatus;
  filter: { kinds: AccountKind[]; programmeIds?: string[]; batchIds?: string[]; departmentIds?: string[] };
  options: { resetExistingPasswords: boolean };
  counts: { scanned: number; created: number; existingLinked: number; skipped: number; failed: number };
  errors: { personId: string; reason: string }[];
  performedBy: string; startedAt?: string; finishedAt?: string; credentialsExpireAt?: string; createdAt: string;
}
export interface CreateRunInput { kinds: AccountKind[]; programmeIds?: string[]; batchIds?: string[]; departmentIds?: string[]; resetExistingPasswords?: boolean }
export interface CredentialGroup { key: 'section' | 'batch' | 'department' | 'none'; id: string | null; label: string; count: number }
export interface CredentialGroupsView { expiresAt: string | null; live: boolean; groups: CredentialGroup[] }

export interface AccountRow {
  id: string; kind: AccountKind; status: AccountStatus; name: string; identifier: string; email: string;
  onboardingComplete: boolean; lastSeenAt: string | null; provisionedAt: string;
  hasLiveCredential: boolean; credentialExpiresAt: string | null;
}
export interface AccountsQuery { kind?: AccountKind; status?: AccountStatus; q?: string; page: number; limit: number }
export interface Paginated<T> { items: T[]; total: number; page: number; pages: number }

export interface ChannelRow {
  _id: string; name: string; templateCode: string; scopeType: string; status: 'active' | 'archived';
  memberCount: number; replyRule: string; defaultPriority: string;
}
export interface TemplateRow {
  code: string; name: string; namePattern: string; scopeType: string; replyRule: string; defaultPriority: string; archiveRule: string; isEnabled: boolean;
}

const clean = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>;

export const getJuviSettings = (): Promise<AdminSettingsView> => api.get(`${BASE}/settings`).then((r) => r.data);
export const updateJuviSettings = (patch: JuviSettingsPatch): Promise<AdminSettingsView> => api.put(`${BASE}/settings`, patch).then((r) => r.data);

export const listRuns = (page = 1, limit = 20): Promise<Paginated<ProvisioningRun>> =>
  api.get(`${BASE}/provisioning/runs`, { params: { page, limit } }).then((r) => r.data);
export const getRun = (runId: string): Promise<ProvisioningRun> => api.get(`${BASE}/provisioning/runs/${runId}`).then((r) => r.data);
export const createRun = (input: CreateRunInput): Promise<ProvisioningRun> => api.post(`${BASE}/provisioning/runs`, input).then((r) => r.data);
export const getCredentialGroups = (runId: string): Promise<CredentialGroupsView> =>
  api.get(`${BASE}/provisioning/runs/${runId}/credential-groups`).then((r) => r.data);

export async function downloadCredentialsCsv(runId: string, group: { key: CredentialGroup['key']; id: string | null }): Promise<{ blob: Blob; filename: string }> {
  const params: Record<string, string> = {};
  if (group.key === 'section' && group.id) params.sectionId = group.id;
  if (group.key === 'batch' && group.id) params.batchId = group.id;
  if (group.key === 'department' && group.id) params.departmentId = group.id;
  // Without this the backend treats an empty filter as "every row in the run".
  if (group.key === 'none') params.unsectioned = 'true';
  const res = await api.get(`${BASE}/provisioning/runs/${runId}/credentials.csv`, { params, responseType: 'blob' });
  const match = /filename="([^"]+)"/.exec(String(res.headers['content-disposition'] ?? ''));
  return { blob: res.data as Blob, filename: match?.[1] ?? 'juvi-credentials.csv' };
}

export const listAccounts = (q: AccountsQuery): Promise<Paginated<AccountRow>> =>
  api.get(`${BASE}/accounts`, { params: clean(q) }).then((r) => r.data);
export const deactivateAccount = (id: string): Promise<{ status: AccountStatus }> => api.post(`${BASE}/accounts/${id}/deactivate`).then((r) => r.data);
export const resetAccountPassword = (id: string): Promise<{ credentialId: string; expiresAt: string }> => api.post(`${BASE}/accounts/${id}/reset-password`).then((r) => r.data);
export const revealAccountCredential = (id: string): Promise<{ identifier: string; password: string; expiresAt: string }> =>
  api.post(`${BASE}/accounts/${id}/reveal-credential`).then((r) => r.data);

export const listChannels = (status?: 'active' | 'archived', page = 1, limit = 50): Promise<Paginated<ChannelRow>> =>
  api.get(`${BASE}/channels`, { params: clean({ status, page, limit }) }).then((r) => r.data);
export const listTemplates = (): Promise<{ items: TemplateRow[] }> => api.get(`${BASE}/templates`).then((r) => r.data);
export const reconcileNow = (): Promise<{ queued: true }> => api.post(`${BASE}/reconcile`).then((r) => r.data);

/** Browser download helper shared by the credentials UI. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
