import { Schema, model, Document } from 'mongoose';
import { AuditEntry, AuditAction, FieldChange } from './types';

/**
 * AuditLog — immutable per-entity activity trail.
 *
 * `action` is intentionally a widened string set (see AuditAction). The three
 * CRUD primitives (`create`/`update`/`delete`) remain the default; domain
 * code with lifecycle semantics (allocation propose→accept, workflow
 * transitions, approval flows) logs the semantic action directly so queries
 * and UI can filter on meaning rather than inferring it from `changes[]`.
 */
export interface IAuditLog extends Document {
  collegeId: Schema.Types.ObjectId;
  entityType: string;
  entityId: string;
  entityName: string;
  studentId?: Schema.Types.ObjectId;
  action: AuditAction;
  changes: FieldChange[];
  performedBy: string;
  timestamp: Date;
}

// Kept in sync with the AuditAction union in shared/types.ts. The union is the
// source of truth; this array is the Mongoose enum mirror.
const AUDIT_ACTIONS: AuditAction[] = [
  'create', 'update', 'delete',
  'propose', 'accept', 'decline', 'withdraw', 'expire',
  'waitlist_promote', 'vacate_request', 'vacate_approve', 'vacate_reject',
  'approve', 'reject', 'submit', 'publish', 'archive',
  'ai_score_computed',
];

const auditLogSchema = new Schema<IAuditLog>({
  collegeId:   { type: Schema.Types.ObjectId, required: true, index: true },
  entityType:  { type: String, required: true, index: true },
  entityId:    { type: String, required: true, index: true },
  entityName:  { type: String, required: true },
  studentId:   { type: Schema.Types.ObjectId, index: true },
  action:      { type: String, enum: AUDIT_ACTIONS, required: true },
  changes:     [{ field: String, displayName: String, oldValue: Schema.Types.Mixed, newValue: Schema.Types.Mixed }],
  performedBy: { type: String, default: 'System' },
  timestamp:   { type: Date, default: Date.now, index: true },
});

auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);

export async function createAuditLog(entry: AuditEntry) {
  return AuditLog.create({ ...entry, timestamp: new Date() });
}
