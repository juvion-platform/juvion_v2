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

export interface ImportCommitContext {
  collegeId: string;
  performedBy: string;
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
   * Given a fully-validated typed row, perform the create + return
   * the _id. Throw `Error` on failure — the orchestrator catches and
   * records the per-row error.
   */
  commitOne: (
    typedRow: Record<string, unknown>,
    ctx: ImportCommitContext,
  ) => Promise<{ id: string }>;
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
