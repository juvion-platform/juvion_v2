import { Schema, model, Document, Types, CallbackError } from 'mongoose';

export type ClassExceptionType = 'cancelled' | 'rescheduled';

export const CLASS_EXCEPTION_TYPES: readonly ClassExceptionType[] = ['cancelled', 'rescheduled'];

/**
 * One exception per (slot, date) occurrence, effective until revoked (spec §4):
 * cancel the class entirely, or move it to a new date/time/room. Rows are never
 * edited or deleted — a change is revoke-then-create — so every reader can
 * reason from active rows (revokedAt null) alone. `reason` is ERP-only text and
 * never reaches the app or a push. Dates are 'YYYY-MM-DD' strings in the
 * college timezone; times are 'HH:MM'.
 */
export interface IClassException extends Document {
  collegeId: Types.ObjectId;
  timetableSlotId: Types.ObjectId;   // → TimetableSlot (the original occurrence)
  courseOfferingId: Types.ObjectId;  // denormalised from the slot for reader scans
  date: string;                      // 'YYYY-MM-DD' — the original occurrence date
  type: ClassExceptionType;
  newDate?: string;                  // required when type is rescheduled
  newStartTime?: string;             // 'HH:MM'
  newEndTime?: string;               // 'HH:MM'
  newRoomId?: Types.ObjectId;        // → Room; omitted to keep the original room
  reason: string;                    // 5–300 chars
  createdBy: Types.ObjectId;         // → User
  revokedAt: Date | null;
  revokedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IClassException>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    timetableSlotId: { type: Schema.Types.ObjectId, ref: 'TimetableSlot', required: true },
    courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    type: { type: String, enum: CLASS_EXCEPTION_TYPES, required: true },
    newDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    newStartTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    newEndTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    newRoomId: { type: Schema.Types.ObjectId, ref: 'Room' },
    reason: { type: String, required: true, minlength: 5, maxlength: 300 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// One ACTIVE exception per (slot, date); revoked rows coexist.
schema.index({ timetableSlotId: 1, date: 1 }, { unique: true, partialFilterExpression: { revokedAt: null } });
// Write-side and read-side scans (R37).
schema.index({ collegeId: 1, courseOfferingId: 1, date: 1 });
schema.index({ collegeId: 1, newDate: 1 });
schema.index({ collegeId: 1, date: 1, revokedAt: 1 });

// A reschedule carries all three new* fields and ends after it starts.
schema.pre('validate', function (next) {
  if (this.type === 'rescheduled') {
    if (!this.newDate) return next(new Error('A reschedule requires newDate') as CallbackError);
    if (!this.newStartTime) return next(new Error('A reschedule requires newStartTime') as CallbackError);
    if (!this.newEndTime) return next(new Error('A reschedule requires newEndTime') as CallbackError);
    const [sH = '0', sM = '0'] = this.newStartTime.split(':');
    const [eH = '0', eM = '0'] = this.newEndTime.split(':');
    if (Number(sH) * 60 + Number(sM) >= Number(eH) * 60 + Number(eM)) {
      return next(new Error('newStartTime must be before newEndTime') as CallbackError);
    }
  }
  next();
});

/** A lean read of a ClassException: fields only, no Document methods. */
export type LeanClassException = Omit<IClassException, keyof Document> & { _id: Types.ObjectId };

export const ClassException = model<IClassException>('ClassException', schema);
