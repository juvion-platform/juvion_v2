/**
 * People agent client — `/api/juvi/people-agent/*` (008 + 009).
 *
 * Narrations and outreach drafts are LLM-backed and spend-gated on the
 * server; the command bar stream lives in `services/agent.ts`.
 */
import api from './api';

const BASE = '/juvi/people-agent';

export interface AlertNarration {
  alertId: string;
  /** One sentence, or null when the model was unavailable — the numbers stand on their own. */
  narrative: string | null;
}

export const getAlertNarrations = (alertIds: string[]): Promise<AlertNarration[]> =>
  api.post<{ narrations: AlertNarration[] }>(`${BASE}/narrations`, { alertIds }).then((r) => r.data.narrations);

export interface OutreachDraft {
  studentId: string;
  studentName: string;
  language: string;
  tone: 'supportive' | 'direct' | 'urgent';
  subject: string;
  body: string;
  /** 'sms' | 'email' | 'whatsapp' | 'call' | 'app' — the guardian's own preference. */
  channel: string;
  guardianName: string | null;
  /** True when the text is the template, not the model's. */
  fallback: boolean;
}

export const getOutreachDrafts = (studentIds: string[]): Promise<OutreachDraft[]> =>
  api.post<{ drafts: OutreachDraft[] }>(`${BASE}/outreach-drafts`, { studentIds }).then((r) => r.data.drafts);

export interface ApprovedOutreach {
  studentId: string;
  subject: string;
  body: string;
  channel: string;
}

export interface OutreachApprovalResult {
  approvedCount: number;
  alertIds: string[];
  /** Always `recorded_not_sent` — no delivery provider is configured. */
  delivery: string;
  deliveryNote: string;
}

export const approveOutreach = (approved: ApprovedOutreach[]): Promise<OutreachApprovalResult> =>
  api.post<OutreachApprovalResult>(`${BASE}/outreach-drafts/approve`, { approved }).then((r) => r.data);
