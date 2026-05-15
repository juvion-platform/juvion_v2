import { Request } from 'express';
import { AuthScope } from './rbac/types';

export interface AuthRequest extends Request {
  collegeId?: string;
  user?: { id: string; name: string; email: string; role: string; personaType: string };
  authScope?: AuthScope;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

/**
 * Audit action. The three legacy CRUD values (`create`, `update`, `delete`)
 * remain the most common. Semantic actions are additive — domains with
 * lifecycle semantics (allocation propose/accept/vacate, workflow
 * transitions, approvals) can log the state-transition name directly
 * rather than overloading `update`. This makes audit queries and UI
 * rendering far easier downstream (e.g. "show me everyone who accepted
 * their hostel proposal last month").
 */
export type AuditAction =
  // CRUD primitives (legacy; always accepted)
  | 'create'
  | 'update'
  | 'delete'
  // Allocation lifecycle (optional-hostel-transport-allotment)
  | 'propose'
  | 'accept'
  | 'decline'
  | 'withdraw'
  | 'expire'
  | 'waitlist_promote'
  | 'vacate_request'
  | 'vacate_approve'
  | 'vacate_reject'
  // Approval / review flows (forward-compat; safe to use where relevant)
  | 'approve'
  | 'reject'
  | 'submit'
  | 'publish'
  | 'archive'
  // AI / scoring events
  | 'ai_score_computed'
  | 'ai_config_suggested'
  | 'ai_config_applied'
  | 'ai_nl_report_query';

export interface AuditEntry {
  collegeId: string;
  entityType: string;
  entityId: string;
  entityName: string;
  action: AuditAction;
  changes: FieldChange[];
  performedBy: string;
  studentId?: string;
}

export interface FieldChange {
  field: string;
  displayName: string;
  oldValue: any;
  newValue: any;
  /**
   * 002-ai-assisted-config §10.3 — provenance of the new value.
   *   'ui'     — admin typed it in the form (default; omitted for back-compat)
   *   'ai'     — value came from an accepted ConfigSuggestion
   *   'import' — value came from a bulk import
   */
  source?: 'ui' | 'ai' | 'import';
}
