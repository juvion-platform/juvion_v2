import { Schema, model, Document, Types } from 'mongoose';
import { ChannelScopeType, CHANNEL_SCOPE_TYPES, TemplateCode, TEMPLATE_CODES, ReplyRule, ChannelPriority } from './ChannelTemplate';

export type ChannelType = 'official' | 'custom' | 'dm';
export type ChannelStatus = 'active' | 'archived';

export interface IChannel extends Document {
  collegeId: Types.ObjectId;
  type: ChannelType;
  templateCode: TemplateCode;
  scopeType: ChannelScopeType;
  scopeId: Types.ObjectId | null;
  semesterId?: Types.ObjectId;
  name: string;
  about: string;
  status: ChannelStatus;
  archivedAt?: Date;
  postingRule: 'publishers_only';
  replyRule: ReplyRule;
  defaultPriority: ChannelPriority;
  memberCount: number;
  createdVia: 'reconcile' | 'admin';
}

const schema = new Schema<IChannel>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    // SPC-01: the full enum exists on the model; only 'official' is creatable in R1.
    type: { type: String, enum: ['official', 'custom', 'dm'], required: true, default: 'official' },
    templateCode: { type: String, enum: TEMPLATE_CODES, required: true },
    scopeType: { type: String, enum: CHANNEL_SCOPE_TYPES, required: true },
    scopeId: { type: Schema.Types.ObjectId, default: null },
    semesterId: { type: Schema.Types.ObjectId, ref: 'Semester' },
    name: { type: String, required: true },
    about: { type: String, required: true },
    status: { type: String, enum: ['active', 'archived'], required: true, default: 'active' },
    archivedAt: Date,
    postingRule: { type: String, enum: ['publishers_only'], required: true },
    replyRule: { type: String, enum: ['allowed', 'announcement_only'], required: true },
    defaultPriority: { type: String, enum: ['routine', 'important'], required: true },
    memberCount: { type: Number, default: 0 },
    createdVia: { type: String, enum: ['reconcile', 'admin'], default: 'reconcile' },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, scopeType: 1, scopeId: 1 }, { unique: true });
schema.index({ collegeId: 1, status: 1 });

export const Channel = model<IChannel>('Channel', schema);
