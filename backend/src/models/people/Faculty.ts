import { Schema, model, Document } from 'mongoose';

export interface IFaculty extends Document {
  collegeId: Schema.Types.ObjectId;
  personId: Schema.Types.ObjectId; employeeCode: string; designation: string; specialization?: string; qualification?: string; departmentId?: Schema.Types.ObjectId; contractType: string; status: string;
}

const schema = new Schema<IFaculty>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  employeeCode: { type: String, required: true },
  designation: { type: String, required: true },
  specialization: String,
  qualification: String,
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
  contractType: { type: String, enum: ['regular', 'contract', 'adjunct', 'visiting'], default: 'regular' },
  status: { type: String, enum: ['active', 'on_leave', 'separated'], default: 'active' },
}, { timestamps: true });

schema.index({ collegeId: 1, employeeCode: 1 }, { unique: true });

export const Faculty = model<IFaculty>('Faculty', schema);
