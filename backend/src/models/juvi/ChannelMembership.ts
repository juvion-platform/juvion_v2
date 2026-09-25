import { Schema, model, Document, Types } from 'mongoose';

export type MembershipRole = 'member' | 'publisher';

export interface IChannelMembership extends Document {
  collegeId: Types.ObjectId;
  channelId: Types.ObjectId;
  accountId: Types.ObjectId;
  role: MembershipRole;
  mutedAt?: Date | null;
  joinedVia: 'rule' | 'admin';
  joinedAt: Date;
  lastReadAt?: Date;
}

const schema = new Schema<IChannelMembership>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'JuviAccount', required: true },
    role: { type: String, enum: ['member', 'publisher'], required: true, default: 'member' },
    mutedAt: { type: Date, default: null },
    joinedVia: { type: String, enum: ['rule', 'admin'], required: true, default: 'rule' },
    joinedAt: { type: Date, default: Date.now },
    lastReadAt: Date,
  },
  { timestamps: true },
);

schema.index({ channelId: 1, accountId: 1 }, { unique: true });
schema.index({ collegeId: 1, accountId: 1 });

export const ChannelMembership = model<IChannelMembership>('ChannelMembership', schema);
