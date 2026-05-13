import { Schema, model, Document, Types } from 'mongoose';

/**
 * FacultyPublication — peer-reviewed papers, conference proceedings,
 * and book chapters with the NAAC-shaped metadata. Strategic Gap 1
 * original Phase B (research outputs).
 *
 * NAAC criteria the field set explicitly serves:
 *   - 3.3   (Papers per teacher in journals notified on the UGC list /
 *            Scopus / WoS)
 *   - 3.4   (Publications per teacher · weighted average impact)
 *
 * The NAAC-mandated fields are: `indexingService`, `quartile`,
 * `impactPercentile`, `level`, `authorPosition`, `sdgMapping`. The
 * resolver in `M11 Compliance` will count rows by indexing service to
 * produce the SSR table; quartile + impact percentile feed the
 * weighted-average score; SDG mapping feeds the SDG-alignment report.
 */

export type FacultyPublicationIndexing =
  | 'scopus'
  | 'wos'           // Web of Science
  | 'ugc_care'      // UGC-CARE list
  | 'other_indexed'
  | 'none';

export type FacultyPublicationQuartile = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export type FacultyPublicationLevel = 'international' | 'national' | 'regional';

export type FacultyPublicationType =
  | 'journal'
  | 'conference'
  | 'book_chapter'
  | 'symposium';

export interface IFacultyPublication extends Document {
  collegeId: Types.ObjectId;
  facultyId: Types.ObjectId;

  // Bibliographic
  title: string;
  /** Comma-separated author list as it appears on the paper. */
  authors: string;
  /**
   * Position of THIS faculty in the author list. Free-text so we can
   * record "first", "corresponding", "second", "last", "5 of 8", etc.
   * NAAC asks for explicit position when computing per-teacher counts.
   */
  authorPosition: string;
  type: FacultyPublicationType;

  journal: string;
  publisher?: string;
  year: number;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  publicationDate?: Date;

  // NAAC-shaped scoring fields
  indexingService: FacultyPublicationIndexing;
  quartile?: FacultyPublicationQuartile;
  /** 0–100. NAAC weighted-average input. */
  impactPercentile?: number;
  level: FacultyPublicationLevel;
  /**
   * UN SDG mapping. Use 'sdg_1', 'sdg_2', ..., 'sdg_17' to match the
   * NAAC SSR template. A paper can map to multiple SDGs.
   */
  sdgMapping?: string[];

  citationCount?: number;
  notes?: string;
  archivedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IFacultyPublication>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true, index: true },

    title: { type: String, required: true, trim: true },
    authors: { type: String, required: true, trim: true },
    authorPosition: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['journal', 'conference', 'book_chapter', 'symposium'],
      required: true,
      default: 'journal',
    },

    journal: { type: String, required: true, trim: true },
    publisher: { type: String, trim: true },
    year: { type: Number, required: true, min: 1900, max: 2100 },
    volume: { type: String, trim: true },
    issue: { type: String, trim: true },
    pages: { type: String, trim: true },
    doi: { type: String, trim: true },
    publicationDate: { type: Date },

    indexingService: {
      type: String,
      enum: ['scopus', 'wos', 'ugc_care', 'other_indexed', 'none'],
      required: true,
      default: 'none',
    },
    quartile: {
      type: String,
      enum: ['Q1', 'Q2', 'Q3', 'Q4'],
    },
    impactPercentile: { type: Number, min: 0, max: 100 },
    level: {
      type: String,
      enum: ['international', 'national', 'regional'],
      required: true,
      default: 'national',
    },
    sdgMapping: { type: [String], default: undefined },

    citationCount: { type: Number, min: 0 },
    notes: { type: String, trim: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, facultyId: 1, archivedAt: 1 });
// NAAC reports filter by indexing + year-window — index keeps that query fast.
schema.index({ collegeId: 1, indexingService: 1, year: -1 });

export const FacultyPublication = model<IFacultyPublication>(
  'FacultyPublication',
  schema,
);
