import { Schema, model, Document, Types } from 'mongoose';

export const JUVI_EVENT_TTL_DAYS = 400;
export type JuviEventProps = Record<string, string | number | boolean>;

/** A product-analytics event from the app (notifications spec §4.2, §7.3): ids and enums only, never content. */
export interface IJuviEvent extends Document {
  collegeId: Types.ObjectId;
  accountId: Types.ObjectId;
  name: string;
  at: Date;
  props: JuviEventProps;
  appVersion: string;
  platform: string;
  receivedAt: Date;
}

const schema = new Schema<IJuviEvent>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  accountId: { type: Schema.Types.ObjectId, ref: 'JuviAccount', required: true },
  name: { type: String, required: true },
  at: { type: Date, required: true },
  props: { type: Schema.Types.Mixed, default: {} },
  appVersion: { type: String, default: '' },
  platform: { type: String, default: '' },
  receivedAt: { type: Date, default: Date.now },
});

schema.index({ receivedAt: 1 }, { expireAfterSeconds: JUVI_EVENT_TTL_DAYS * 86_400 });
schema.index({ collegeId: 1, name: 1, at: -1 });

export const JuviEvent = model<IJuviEvent>('JuviEvent', schema);
