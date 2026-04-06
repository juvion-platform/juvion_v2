import { Schema, model, Document } from 'mongoose';
export interface IHostelVisitorLog extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; visitorName: string; visitorRelation: string; visitorPhone: string; inTime: Date; outTime?: Date; purpose: string; }
const schema = new Schema<IHostelVisitorLog>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  visitorName: { type: String, required: true },
  visitorRelation: { type: String, required: true },
  visitorPhone: { type: String, required: true },
  inTime: { type: Date, default: Date.now },
  outTime: Date,
  purpose: { type: String, required: true },
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1, inTime: -1 });
export const HostelVisitorLog = model<IHostelVisitorLog>('HostelVisitorLog', schema);
