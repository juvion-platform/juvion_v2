import { Schema, model, Document } from 'mongoose';
import { AuditEntry, FieldChange } from './types';

export interface IAuditLog extends Document {
  collegeId: Schema.Types.ObjectId;
  entityType: string;
  entityId: string;
  entityName: string;
  studentId?: Schema.Types.ObjectId;
  action: 'create' | 'update' | 'delete';
  changes: FieldChange[];
  performedBy: string;
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
  collegeId:   { type: Schema.Types.ObjectId, required: true, index: true },
  entityType:  { type: String, required: true, index: true },
  entityId:    { type: String, required: true, index: true },
  entityName:  { type: String, required: true },
  studentId:   { type: Schema.Types.ObjectId, index: true },
  action:      { type: String, enum: ['create', 'update', 'delete'], required: true },
  changes:     [{ field: String, displayName: String, oldValue: Schema.Types.Mixed, newValue: Schema.Types.Mixed }],
  performedBy: { type: String, default: 'System' },
  timestamp:   { type: Date, default: Date.now, index: true },
});

auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);

export async function createAuditLog(entry: AuditEntry) {
  return AuditLog.create({ ...entry, timestamp: new Date() });
}
