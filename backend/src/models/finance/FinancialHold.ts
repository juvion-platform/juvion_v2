import { Schema, model, Document } from 'mongoose';

export interface IFinancialHold extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  defaulterRecordId: Schema.Types.ObjectId;
  holdType: 'exam_debarment' | 'hostel_restriction' | 'transcript_hold' | 'full_clearance_block';
  holdStatus: 'active' | 'released';
  effectiveDate: Date;
  approvedBy: Schema.Types.ObjectId;
  releaseDate?: Date;
  releasedBy?: Schema.Types.ObjectId;
  releaseReason?: string;
}

const schema = new Schema<IFinancialHold>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  defaulterRecordId: { type: Schema.Types.ObjectId, ref: 'DefaulterRecord', required: true },
  holdType: {
    type: String,
    enum: ['exam_debarment', 'hostel_restriction', 'transcript_hold', 'full_clearance_block'],
    required: true,
  },
  holdStatus: {
    type: String,
    enum: ['active', 'released'],
    default: 'active',
  },
  effectiveDate: { type: Date, default: Date.now },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  releaseDate: { type: Date },
  releasedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  releaseReason: { type: String },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, holdStatus: 1 });

export const FinancialHold = model<IFinancialHold>('FinancialHold', schema);
