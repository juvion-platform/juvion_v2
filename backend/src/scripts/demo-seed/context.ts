import { Types } from 'mongoose';

/** Written on every row this seed creates where the model has somewhere to put it. */
export const TAG = 'demo-v2';

export const DAY = 86_400_000;

export function daysAgo(n: number, hour = 10): Date {
  const d = new Date(Date.now() - n * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Deterministic PRNG, so every run builds the same university. */
export function rng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  return {
    next,
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
  };
}

export interface DemoFaculty {
  _id: Types.ObjectId;
  personId: Types.ObjectId;
  dept: string;
}

export interface DemoStudent {
  _id: Types.ObjectId;
  personId: Types.ObjectId;
  rollNumber: string;
  branch: string;
  /** Year of study in the demo academic year, 1–4. */
  year: number;
  sectionId: Types.ObjectId;
}

/** Everything the steps share once the foundations exist. */
export interface DemoCtx {
  collegeId: string;
  collegeName: string;
  /** AY2026-27, current. */
  ayId: Types.ObjectId;
  /** Odd term of AY2026-27, active. */
  semesterId: Types.ObjectId;
  semesterStart: Date;
  regulationId: Types.ObjectId;
  programmeId: Types.ObjectId;
  /** Keyed by code: CSE, ECE, MECH, CIVIL. */
  departments: Record<string, Types.ObjectId>;
  branches: Record<string, Types.ObjectId>;
  faculty: DemoFaculty[];
  /** Staff row usable wherever a model needs a Staff reporter (warden). */
  staffId: Types.ObjectId;
  staffPersonId: Types.ObjectId;
  /** Filled by the students step; empty before it. */
  students: DemoStudent[];
  log: (m: string) => void;
}
