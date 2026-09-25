import { Schema, model, Document, Types } from 'mongoose';
import { AccountKind, ACCOUNT_KINDS } from './JuviAccount';

export type ProvisioningRunStatus = 'queued' | 'running' | 'completed' | 'partial' | 'failed';

export interface IProvisioningFilter {
  kinds: AccountKind[];
  programmeIds?: Types.ObjectId[];
  batchIds?: Types.ObjectId[];
  departmentIds?: Types.ObjectId[];
}

export interface IJuviProvisioningRun extends Omit<Document, 'errors'> {
  collegeId: Types.ObjectId;
  filter: IProvisioningFilter;
  options: { resetExistingPasswords: boolean };
  status: ProvisioningRunStatus;
  counts: { scanned: number; created: number; existingLinked: number; skipped: number; failed: number };
  errors: { personId: Types.ObjectId; reason: string }[];
  performedBy: string;
  startedAt?: Date;
  finishedAt?: Date;
  credentialsExpireAt?: Date;
}

const schema = new Schema<IJuviProvisioningRun>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    filter: {
      kinds: { type: [{ type: String, enum: ACCOUNT_KINDS }], required: true },
      programmeIds: [{ type: Schema.Types.ObjectId, ref: 'Programme' }],
      batchIds: [{ type: Schema.Types.ObjectId, ref: 'Batch' }],
      departmentIds: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
    },
    options: { resetExistingPasswords: { type: Boolean, default: true } },
    status: { type: String, enum: ['queued', 'running', 'completed', 'partial', 'failed'], default: 'queued' },
    counts: {
      scanned: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      existingLinked: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    errors: { type: [{ personId: Schema.Types.ObjectId, reason: String, _id: false }], default: [] },
    performedBy: { type: String, required: true },
    startedAt: Date,
    finishedAt: Date,
    credentialsExpireAt: Date,
  },
  { timestamps: true, suppressReservedKeysWarning: true },
);

schema.index({ collegeId: 1, createdAt: -1 });

export const JuviProvisioningRun = model<IJuviProvisioningRun>('JuviProvisioningRun', schema);
