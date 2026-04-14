import { Schema, model, Document } from 'mongoose';

export interface IAlumni extends Document {
  collegeId: Schema.Types.ObjectId;
  personId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  programmeId: Schema.Types.ObjectId;
  branchId: Schema.Types.ObjectId;
  batchId?: Schema.Types.ObjectId;
  regulationId?: Schema.Types.ObjectId;
  graduationDate: Date;
  degreeAwarded: string;
  finalCgpa: number;
  classObtained: 'first_class_distinction' | 'first_class' | 'second_class' | 'pass';
  convocationStatus: 'pending' | 'attended' | 'absentia' | 'direct_collection';
  convocationDate?: Date;
  engagementStatus: 'active' | 'inactive' | 'revoked';
  lastContactDate?: Date;
  alumniProfileId?: Schema.Types.ObjectId;
  isPosthumous: boolean;
  metadata?: Schema.Types.Mixed;
}

const schema = new Schema<IAlumni>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'Batch' },
  regulationId: { type: Schema.Types.ObjectId, ref: 'Regulation' },
  graduationDate: { type: Date, required: true },
  degreeAwarded: { type: String, required: true },
  finalCgpa: { type: Number, required: true },
  classObtained: { type: String, enum: ['first_class_distinction', 'first_class', 'second_class', 'pass'], required: true },
  convocationStatus: { type: String, enum: ['pending', 'attended', 'absentia', 'direct_collection'], default: 'pending' },
  convocationDate: Date,
  engagementStatus: { type: String, enum: ['active', 'inactive', 'revoked'], default: 'active' },
  lastContactDate: Date,
  alumniProfileId: { type: Schema.Types.ObjectId, ref: 'AlumniProfile' },
  isPosthumous: { type: Boolean, default: false },
  metadata: Schema.Types.Mixed,
}, { timestamps: true });

schema.index({ collegeId: 1, personId: 1 }, { unique: true });
schema.index({ collegeId: 1, programmeId: 1, graduationDate: -1 });

export const Alumni = model<IAlumni>('Alumni', schema);
