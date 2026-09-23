import { Schema, model, Document, Types } from 'mongoose';

export type CredentialSource = 'bulk' | 'workflow' | 'admin';

export interface IJuviProvisionedCredential extends Document {
  collegeId: Types.ObjectId;
  runId?: Types.ObjectId | null;
  accountId: Types.ObjectId;
  source: CredentialSource;
  identifier: string;
  displayName: string;
  sectionId?: Types.ObjectId;
  batchId?: Types.ObjectId;
  departmentId?: Types.ObjectId;
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  expiresAt: Date;
}

const schema = new Schema<IJuviProvisionedCredential>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    runId: { type: Schema.Types.ObjectId, ref: 'JuviProvisioningRun', default: null },
    accountId: { type: Schema.Types.ObjectId, ref: 'JuviAccount', required: true },
    source: { type: String, enum: ['bulk', 'workflow', 'admin'], required: true },
    identifier: { type: String, required: true },
    displayName: { type: String, required: true },
    sectionId: { type: Schema.Types.ObjectId, ref: 'Section' },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch' },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    ciphertext: { type: Buffer, required: true },
    iv: { type: Buffer, required: true },
    authTag: { type: Buffer, required: true },
    // TTL index: Mongo deletes the row when expiresAt passes.
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, runId: 1, sectionId: 1 });
schema.index({ collegeId: 1, accountId: 1 });

export const JuviProvisionedCredential = model<IJuviProvisionedCredential>('JuviProvisionedCredential', schema);
