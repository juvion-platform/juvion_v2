import { Schema, model, Document, Types } from 'mongoose';
import { AccountKind, ACCOUNT_KINDS } from './JuviAccount';

export type AckMethod = 'hold' | 'confirm';
export const ACK_METHODS: readonly AckMethod[] = ['hold', 'confirm'];
export const ACK_COMMENT_MAX = 500;

export interface INoticeAck {
  at: Date;
  late: boolean;
  method: AckMethod;
  sessionId: Types.ObjectId;
  offline: boolean;
  clientAt?: Date;
  comment?: string;
}

/** Names frozen at publish, used to group reach (spec §5). */
export interface IRecipientLabels { batch?: string; section?: string; department?: string }

/**
 * One row per audience member: the audience snapshot and that person's state.
 * `accountId` is null while the person is not on Juvi; `ack` is set exactly once
 * by a conditional update on `ack: null`.
 */
export interface INoticeRecipient extends Document {
  collegeId: Types.ObjectId;
  noticeId: Types.ObjectId;
  personId: Types.ObjectId;
  accountId: Types.ObjectId | null;
  kind: AccountKind;
  labels: IRecipientLabels;
  addedLater: boolean;
  ackRequired: boolean;
  deadline: Date | null;
  receivedAt?: Date | null;
  seenAt?: Date | null;
  dismissedAt?: Date | null;
  remindedAt?: Date | null;
  ack: INoticeAck | null;
  archived: boolean;
}

const ackSchema = new Schema<INoticeAck>(
  {
    at: { type: Date, required: true },
    late: { type: Boolean, required: true },
    method: { type: String, enum: ACK_METHODS, required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'MobileSession', required: true },
    offline: { type: Boolean, required: true },
    clientAt: Date,
    comment: { type: String, maxlength: ACK_COMMENT_MAX },
  },
  { _id: false },
);

const schema = new Schema<INoticeRecipient>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    noticeId: { type: Schema.Types.ObjectId, ref: 'Notice', required: true },
    personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'JuviAccount', default: null },
    kind: { type: String, enum: ACCOUNT_KINDS, required: true },
    labels: { batch: String, section: String, department: String },
    addedLater: { type: Boolean, default: false },
    ackRequired: { type: Boolean, default: false },
    deadline: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    seenAt: { type: Date, default: null },
    dismissedAt: { type: Date, default: null },
    remindedAt: { type: Date, default: null },
    ack: { type: ackSchema, default: null },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

schema.index({ noticeId: 1, personId: 1 }, { unique: true });
schema.index({ collegeId: 1, accountId: 1, ackRequired: 1, 'ack.at': 1, deadline: 1 });
schema.index({ collegeId: 1, accountId: 1, receivedAt: -1 });
schema.index({ noticeId: 1, seenAt: 1, 'ack.at': 1 });

/** A lean read of a NoticeRecipient: fields only, no Document methods. */
export type LeanNoticeRecipient = Omit<INoticeRecipient, keyof Document> & { _id: Types.ObjectId };

export const NoticeRecipient = model<INoticeRecipient>('NoticeRecipient', schema);
