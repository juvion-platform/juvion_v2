import { Schema, model, Document } from 'mongoose';
export interface ISurveyResponse extends Document { collegeId: Schema.Types.ObjectId; surveyId: Schema.Types.ObjectId; respondentId: Schema.Types.ObjectId; answers: { questionIndex: number; answer: any }[]; submittedAt: Date; }
const schema = new Schema<ISurveyResponse>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, surveyId: { type: Schema.Types.ObjectId, ref: 'FeedbackSurvey', required: true }, respondentId: { type: Schema.Types.ObjectId, ref: 'Person', required: true }, answers: [{ questionIndex: Number, answer: Schema.Types.Mixed }], submittedAt: { type: Date, default: Date.now } }, { timestamps: true });
schema.index({ collegeId: 1, surveyId: 1, respondentId: 1 }, { unique: true });
export const SurveyResponse = model<ISurveyResponse>('SurveyResponse', schema);
