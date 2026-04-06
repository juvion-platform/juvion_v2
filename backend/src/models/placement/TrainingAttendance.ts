import { Schema, model, Document } from 'mongoose';

export interface ITrainingAttendance extends Document {
  collegeId: Schema.Types.ObjectId;
  trainingId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; attended: boolean;
}

const schema = new Schema<ITrainingAttendance>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  trainingId: { type: Schema.Types.ObjectId, ref: 'PlacementTraining', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  attended: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ collegeId: 1, trainingId: 1, studentId: 1 }, { unique: true });

export const TrainingAttendance = model<ITrainingAttendance>('TrainingAttendance', schema);
