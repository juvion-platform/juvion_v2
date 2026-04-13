import { Schema, model, Document } from 'mongoose';

export interface IInvigilationRoster extends Document {
  collegeId: Schema.Types.ObjectId;
  examScheduleId: Schema.Types.ObjectId;
  duties: {
    facultyId: Schema.Types.ObjectId;
    roomName: string;
    role: string;
  }[];
  status: string;
  generatedBy?: Schema.Types.ObjectId;
}

const schema = new Schema<IInvigilationRoster>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  examScheduleId: { type: Schema.Types.ObjectId, ref: 'ExamSchedule', required: true },
  duties: [{
    facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
    roomName: { type: String, required: true },
    role: { type: String, enum: ['chief', 'assistant', 'flying_squad'], required: true },
  }],
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  generatedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
}, { timestamps: true });

schema.index({ collegeId: 1, examScheduleId: 1 });

export const InvigilationRoster = model<IInvigilationRoster>('InvigilationRoster', schema);
