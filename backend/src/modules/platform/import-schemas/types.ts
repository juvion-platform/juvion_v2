/**
 * import-schemas/types — shared type surface for the bulk-import
 * schema registry.
 *
 * Extracted out of `bulk-import-registry.ts` so entity-specific schema
 * modules (student, faculty, staff, applicant, programme) can import
 * these types without pulling in the whole registry (and its
 * `peopleService` / `admissionsService` / `academicsService` deps).
 * `bulk-import-registry.ts` re-exports all three so existing imports
 * from that module keep working unchanged.
 */

import { IImportJobSchemaField } from '../../../models/platform/ImportJob';
import type { PinOutcome } from '../../people/student-import-pin';

export interface ImportCommitContext {
  collegeId: string;
  performedBy: string;
  /**
   * The ImportJob these rows belong to. Always available — the job id is
   * minted before parsing — and it is what makes a side effect traceable
   * back to the upload that caused it (fee pins record it in `remarks`).
   */
  jobId: string;
  /**
   * Academic year that fee-pin resolution runs against, resolved once and
   * frozen on the job at preview so commit cannot drift if `isCurrent` flips
   * between the two calls. Undefined when the job could not resolve one.
   */
  academicYearId?: string;
  /**
   * Per-job memo store handed to `validateRow`, so a schema can avoid
   * re-querying reference data that is identical across rows.
   *
   * Present ONLY during preview. Commit deliberately gets none: reusing a
   * cached match to write a pin would persist a fee structure that was
   * superseded between the two calls.
   */
  previewCache?: Map<string, unknown>;
}

export interface ImportSchemaField extends IImportJobSchemaField {
  /**
   * Validator. Receives the trimmed raw cell value AND the full row
   * (so cross-field validation can run). Returns either `{ ok: true,
   * value }` (the coerced typed value to pass to the commit handler)
   * or `{ ok: false, error }` to mark the row failed.
   */
  validate: (
    rawValue: string,
    row: Record<string, string>,
    ctx: ImportCommitContext,
  ) => { ok: true; value: unknown } | { ok: false; error: string };
}

/**
 * What committing a row would do. Computed during preview by the optional
 * `validateRow` hook so the operator sees Create / Update / Blocked before
 * anything is written.
 */
export type ImportRowAction = 'create' | 'update' | 'blocked';

export interface ImportSchemaDefinition {
  entityType: string;
  label: string;
  description: string;
  fields: ImportSchemaField[];
  /** Sample row for the downloadable CSV template. Keys must be `fieldKey`. */
  sampleRow: Record<string, string>;
  /**
   * Opt in to having the engine resolve and freeze an academic year for the
   * job, and to per-row pin accounting. Only the student schema pins; the
   * other four never touch fee structures and must not pay for the lookup.
   */
  requiresPinAcademicYear?: boolean;
  /**
   * Given a fully-validated typed row, perform the create + return
   * the _id. Throw `Error` on failure — the orchestrator catches and
   * records the per-row error.
   *
   * `pinOutcome` reports a fee pin the commit attempted alongside the row.
   * It is deliberately a return value and never a throw: the orchestrator
   * turns any throw into `outcome:'error'`, so a college that has not yet
   * published its fee structures would otherwise turn a clean import red.
   * Only the student schema sets it.
   */
  commitOne: (
    typedRow: Record<string, unknown>,
    ctx: ImportCommitContext,
  ) => Promise<{ id: string; pinOutcome?: PinOutcome }>;
  /**
   * OPTIONAL, opt-in. The natural keys this row would match an existing
   * record on — the same keys, in the same precedence order, that the
   * entity's own matcher consults.
   *
   * The engine tracks these across the WHOLE uploaded file and fails the
   * second and subsequent row claiming a key an earlier row already claimed:
   * `duplicate rollNumber "CS2025-014" — also on row 7`.
   *
   * Why this exists: preview classifies every row against the database as it
   * stands BEFORE the batch, while commit processes rows sequentially, each
   * seeing its predecessors' writes. For an upserting schema that means two
   * rows sharing a key both preview as "Create", then at commit row 2 matches
   * the record row 1 just created and overwrites it — row 2's record never
   * exists, row 1's is destroyed, and the job reports two successes. Adopting
   * upsert removed the unique-index safety net that used to hard-fail row 2.
   *
   * Emit EVERY key the row presents, not only the highest-precedence one:
   * matchers fall through from one key to the next, so a row with a fresh
   * rollNumber but a repeated phone can still land on the earlier row's
   * record.
   *
   * Schemas that omit this (faculty, staff, applicant, programme) are not
   * checked at all — the engine's behaviour for them is unchanged.
   *
   * Must be synchronous and side-effect free: it runs for every row.
   */
  naturalKeys?: (
    typedRow: Record<string, unknown>,
  ) => Array<{ label: string; value: string }>;
  /**
   * Optional async per-row check, run after every field validator passes.
   *
   * `validate` is synchronous and therefore cannot hit the database, so
   * anything needing a lookup — resolving codes to ids, deciding whether a
   * row creates or updates — belongs here. Without it, preview could only
   * report shape errors and every reference problem would surface at commit,
   * after the operator has already confirmed.
   *
   * Returning `ok: false` fails the row exactly like a field validator.
   * `notes` are advisory strings shown in the preview (e.g. side effects the
   * commit would cause). `resolved` is a label -> display-value map echoing
   * what the row's codes resolved to, so the operator can confirm that
   * "BTCSE" really is the programme they meant before committing.
   *
   * `sideEffects` is a counter-name -> increment map summed across *every*
   * row into `sideEffectTotals`. Preview only returns the first
   * PREVIEW_SUCCESS_LIMIT rows, so a total like "guardians to create" cannot
   * be derived client-side from previewRows — it has to be accumulated here.
   */
  validateRow?: (
    typedRow: Record<string, unknown>,
    rawRow: Record<string, string>,
    ctx: ImportCommitContext,
  ) => Promise<
    | {
        ok: true;
        action: ImportRowAction;
        notes?: string[];
        resolved?: Record<string, string>;
        sideEffects?: Record<string, number>;
      }
    | { ok: false; error: string }
  >;
}
