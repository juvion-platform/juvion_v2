import { Schema, model, Document, Types } from 'mongoose';

export type TemplateCode = 'college' | 'department' | 'batch' | 'course' | 'hostel';
export type ChannelScopeType = 'college' | 'department' | 'batch' | 'course_offering' | 'hostel_block';
export type ReplyRule = 'allowed' | 'announcement_only';
export type ChannelPriority = 'routine' | 'important';
export type ArchiveRule = 'on_semester_end' | 'never';

export const TEMPLATE_CODES: readonly TemplateCode[] = ['college', 'department', 'batch', 'course', 'hostel'];
export const CHANNEL_SCOPE_TYPES: readonly ChannelScopeType[] = ['college', 'department', 'batch', 'course_offering', 'hostel_block'];

export interface IChannelTemplate extends Document {
  collegeId: Types.ObjectId;
  code: TemplateCode;
  name: string;
  namePattern: string;
  aboutPattern: string;
  scopeType: ChannelScopeType;
  membershipStrategy: TemplateCode;
  postingRule: 'publishers_only';
  replyRule: ReplyRule;
  defaultPriority: ChannelPriority;
  archiveRule: ArchiveRule;
  isEnabled: boolean;
}

const schema = new Schema<IChannelTemplate>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    code: { type: String, enum: TEMPLATE_CODES, required: true },
    name: { type: String, required: true },
    namePattern: { type: String, required: true },
    aboutPattern: { type: String, required: true },
    scopeType: { type: String, enum: CHANNEL_SCOPE_TYPES, required: true },
    membershipStrategy: { type: String, enum: TEMPLATE_CODES, required: true },
    postingRule: { type: String, enum: ['publishers_only'], required: true, default: 'publishers_only' },
    replyRule: { type: String, enum: ['allowed', 'announcement_only'], required: true },
    defaultPriority: { type: String, enum: ['routine', 'important'], required: true },
    archiveRule: { type: String, enum: ['on_semester_end', 'never'], required: true },
    isEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, code: 1 }, { unique: true });

/** A lean read of a ChannelTemplate: fields only, no Document methods. */
export type LeanChannelTemplate = Omit<IChannelTemplate, keyof Document> & { _id: Types.ObjectId };

export const ChannelTemplate = model<IChannelTemplate>('ChannelTemplate', schema);
