import { Schema, model, Document, Types } from 'mongoose';

export type MobilePlatform = 'android' | 'ios';
export type RevokeReason =
  | 'sign_out' | 'signed_out_elsewhere' | 'password_changed'
  | 'admin' | 'deactivated' | 'token_reuse' | 'expired';

export const REVOKE_REASONS: readonly RevokeReason[] = [
  'sign_out', 'signed_out_elsewhere', 'password_changed', 'admin', 'deactivated', 'token_reuse', 'expired',
];

export interface IMobileSession extends Document {
  collegeId: Types.ObjectId;
  accountId: Types.ObjectId;
  userId: Types.ObjectId;
  deviceId: string;
  deviceName: string;
  platform: MobilePlatform;
  appVersion: string;
  osVersion: string;
  refreshTokenHash: string;
  refreshExpiresAt: Date;
  lastActiveAt: Date;
  revokedAt?: Date;
  revokedReason?: RevokeReason;
  pushToken?: string;
  createdAt: Date;
}

const schema = new Schema<IMobileSession>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'JuviAccount', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deviceId: { type: String, required: true },
    deviceName: { type: String, required: true },
    platform: { type: String, enum: ['android', 'ios'], required: true },
    appVersion: { type: String, required: true },
    osVersion: { type: String, required: true },
    refreshTokenHash: { type: String, required: true },
    refreshExpiresAt: { type: Date, required: true },
    lastActiveAt: { type: Date, default: Date.now },
    revokedAt: Date,
    revokedReason: { type: String, enum: REVOKE_REASONS },
    pushToken: String,
  },
  { timestamps: true },
);

schema.index({ refreshTokenHash: 1 }, { unique: true });
schema.index({ collegeId: 1, accountId: 1 });
schema.index({ accountId: 1, deviceId: 1 });

export const MobileSession = model<IMobileSession>('MobileSession', schema);
