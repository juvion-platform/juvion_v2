import { Schema, model, Document, Types } from 'mongoose';

/**
 * FacultyBook — books and book chapters authored / edited by a
 * faculty member. Strategic Gap 1 Phase D.
 *
 * NAAC criterion 3.3 (Books and chapters in edited volumes published
 * per teacher during the year) counts directly off this collection.
 * The `level` field carries the international / national / regional
 * tag NAAC asks for.
 *
 * Multi-tenancy: every row carries `collegeId`. Index on
 * (collegeId, facultyId) drives the per-faculty panel.
 */

export type FacultyBookRole =
  | 'author'
  | 'co_author'
  | 'editor'
  | 'co_editor'
  | 'translator';

export type FacultyBookType =
  | 'textbook'
  | 'monograph'
  | 'edited_volume'
  | 'chapter';

export type FacultyBookLevel = 'international' | 'national' | 'regional';

export interface IFacultyBook extends Document {
  collegeId: Types.ObjectId;
  facultyId: Types.ObjectId;

  title: string;
  role: FacultyBookRole;
  bookType: FacultyBookType;
  publisher: string;
  /** 10 or 13 digit ISBN string; not validated strictly to allow
   *  hyphenation. */
  isbn?: string;
  year: number;
  edition?: string;
  pages?: number;
  level: FacultyBookLevel;

  /** Optional co-author / co-editor list as comma-separated names. */
  coAuthors?: string;
  /** DOI or publisher URL. */
  doi?: string;
  notes?: string;
  archivedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IFacultyBook>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true, index: true },

    title: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['author', 'co_author', 'editor', 'co_editor', 'translator'],
      required: true,
      default: 'author',
    },
    bookType: {
      type: String,
      enum: ['textbook', 'monograph', 'edited_volume', 'chapter'],
      required: true,
      default: 'textbook',
    },
    publisher: { type: String, required: true, trim: true },
    isbn: { type: String, trim: true },
    year: { type: Number, required: true, min: 1900, max: 2100 },
    edition: { type: String, trim: true },
    pages: { type: Number, min: 0 },
    level: {
      type: String,
      enum: ['international', 'national', 'regional'],
      required: true,
      default: 'national',
    },
    coAuthors: { type: String, trim: true },
    doi: { type: String, trim: true },
    notes: { type: String, trim: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, facultyId: 1, archivedAt: 1 });
schema.index({ collegeId: 1, year: -1 });

export const FacultyBook = model<IFacultyBook>('FacultyBook', schema);
