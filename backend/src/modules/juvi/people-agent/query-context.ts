/**
 * 009 T7 — the deterministic bundle the People command bar answers FROM.
 *
 * Same contract as finance: the model never queries the database. Everything
 * here is an existing 008 aggregation, scoped exactly as the board itself is
 * (authScope, then the mentor restriction on top), so a mentor's answers can
 * only ever cover their own mentees.
 *
 * Capped at the top 50 rows by score (~8-12k tokens serialised). The cap is
 * stated in `scope.note` so the model says "of the top 50" rather than
 * implying it saw everyone.
 */
import { AuthScope } from '../../../shared/rbac/types';
import {
  enrichBoardRows,
  getMentorWorkload,
  getOutreachEffectiveness,
  getRiskBoard,
  getSignalsBySource,
} from '../../welfare/ccd-dashboard-service';
import { mentorMenteeIds } from '../../welfare/mentor-scope';

export const BOARD_CAP = 50;

export interface PeopleQueryRow {
  rollNumber: string;
  studentName: string;
  priority: string | null;
  score: number;
  delta7d: number | null;
  status: string;
  daysOpen: number;
  lastActionAt: string | null;
  mentorName: string | null;
  sources: string[];
  signalTypes: string[];
  branch: string | null;
  yearOfStudy: number;
  quota: string | null;
  category: string | null;
  firstGeneration: boolean;
  hostelResident: boolean;
}

export interface PeopleQueryBundle {
  generatedAt: string;
  scope: { note: string; rowsShown: number; rowsTotal: number; cap: number };
  board: PeopleQueryRow[];
  signalsBySource30d: Awaited<ReturnType<typeof getSignalsBySource>>;
  mentorWorkload: Awaited<ReturnType<typeof getMentorWorkload>>;
  outreachEffectiveness90d: Awaited<ReturnType<typeof getOutreachEffectiveness>>;
}

export async function forPeopleQuery(
  collegeId: string,
  authScope?: AuthScope,
): Promise<PeopleQueryBundle> {
  const [fullBoard, signalsBySource30d, mentorWorkload, outreachEffectiveness90d, mentees] =
    await Promise.all([
      getRiskBoard(collegeId, authScope),
      getSignalsBySource(collegeId, 30),
      getMentorWorkload(collegeId, 14, authScope),
      getOutreachEffectiveness(collegeId, 90),
      mentorMenteeIds(collegeId, authScope?.personId),
    ]);

  const top = fullBoard.slice(0, BOARD_CAP);
  const enriched = await enrichBoardRows(collegeId, top);

  const who = mentees !== null
    ? 'your own mentees only'
    : authScope?.departmentOnly
      ? 'your department only'
      : 'the whole college';
  const note =
    `Open risk alerts for ${who}: top ${BOARD_CAP} by score are listed (${enriched.length} of ${fullBoard.length}). ` +
    'Signals and outreach figures are counts over the stated window.';

  return {
    generatedAt: new Date().toISOString(),
    scope: { note, rowsShown: enriched.length, rowsTotal: fullBoard.length, cap: BOARD_CAP },
    board: enriched.map((r) => ({
      rollNumber: r.rollNumber,
      studentName: r.studentName,
      priority: r.priority,
      score: r.score,
      delta7d: r.delta7d,
      status: r.status,
      daysOpen: r.daysOpen,
      lastActionAt: r.lastActionAt,
      mentorName: r.mentorName,
      sources: r.sources,
      signalTypes: r.signalTypes,
      branch: r.branch,
      yearOfStudy: r.yearOfStudy,
      quota: r.quota,
      category: r.category,
      firstGeneration: r.firstGeneration,
      hostelResident: r.hostelResident,
    })),
    signalsBySource30d,
    mentorWorkload,
    outreachEffectiveness90d,
  };
}
