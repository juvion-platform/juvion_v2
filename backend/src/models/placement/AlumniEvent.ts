import { Schema, model, Document } from 'mongoose';

export interface IAlumniEvent extends Document {
  collegeId: Schema.Types.ObjectId;
  title: string; eventType: string; date: Date; venue?: string; description?: string; organizerId?: Schema.Types.ObjectId; status: string;
}

const schema = new Schema<IAlumniEvent>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true },
  eventType: { type: String, enum: ['reunion', 'talk', 'mentoring', 'networking'], required: true },
  date: { type: Date, required: true },
  venue: String,
  description: String,
  organizerId: { type: Schema.Types.ObjectId, ref: 'Person' },
  status: { type: String, enum: ['planned', 'ongoing', 'completed'], default: 'planned' },
}, { timestamps: true });

schema.index({ collegeId: 1, date: -1 });

export const AlumniEvent = model<IAlumniEvent>('AlumniEvent', schema);
