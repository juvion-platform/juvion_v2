import { Schema, model, Document } from 'mongoose';

export interface IPublication extends Document {
  collegeId: Schema.Types.ObjectId;
  facultyId: Schema.Types.ObjectId; title: string; type: string; journalName?: string; conferenceName?: string; publishedDate?: Date; doi?: string; impactFactor?: number; indexing?: string;
}

const schema = new Schema<IPublication>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
  title: { type: String, required: true },
  type: { type: String, enum: ['journal', 'conference', 'book', 'book_chapter', 'patent'], required: true },
  journalName: String,
  conferenceName: String,
  publishedDate: Date,
  doi: String,
  impactFactor: Number,
  indexing: { type: String, enum: ['scopus', 'sci', 'wos', 'ugc_care', 'other'] },
}, { timestamps: true });

schema.index({ collegeId: 1, facultyId: 1 });

export const Publication = model<IPublication>('Publication', schema);
