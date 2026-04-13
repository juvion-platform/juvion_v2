import { Schema, model, Document } from 'mongoose';

export interface IPOAttainmentRecord extends Document {
  collegeId: Schema.Types.ObjectId;
  programmeId: Schema.Types.ObjectId;
  semesterId: Schema.Types.ObjectId;
  poCode: string;
  attainment: number;
  attainmentLevel: number;
  contributingCOs: {
    coCode: string;
    courseOfferingId: Schema.Types.ObjectId;
    coAttainment: number;
    mappingLevel: number;
  }[];
}

const schema = new Schema<IPOAttainmentRecord>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  poCode: { type: String, required: true },
  attainment: { type: Number, required: true },
  attainmentLevel: { type: Number, required: true },
  contributingCOs: [{
    coCode: { type: String, required: true },
    courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
    coAttainment: { type: Number, required: true },
    mappingLevel: { type: Number, required: true },
  }],
}, { timestamps: true });

schema.index({ collegeId: 1, programmeId: 1, semesterId: 1, poCode: 1 }, { unique: true });

export const POAttainmentRecord = model<IPOAttainmentRecord>('POAttainmentRecord', schema);
