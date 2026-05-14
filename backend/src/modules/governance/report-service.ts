/**
 * report-service — orchestrates ReportDefinition execution and
 * persists ReportRun history. Strategic Gap 4 Phase A.
 *
 * In-flight execution is synchronous (single request, single roundtrip)
 * because the v1 12 reports are all <50k-row aggregations that run in
 * <1 second. Phase B may move long-running reports onto BullMQ; the
 * ReportRun model already has the `queued|running|success|failed`
 * state machine that supports that transition.
 */

import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';
import { ReportRun, IReportRun } from '../../models/governance/ReportRun';
import {
  listReportDefinitions, getReportDefinition,
  PhaseBStubError,
} from './report-registry';

// ─── Catalog ────────────────────────────────────────────────────

export function listDefinitions() {
  return { definitions: listReportDefinitions() };
}

export function getDefinition(code: string) {
  const def = getReportDefinition(code);
  if (!def) throw new AppError(404, `Unknown report: ${code}`);
  return def;
}

// ─── Runs ───────────────────────────────────────────────────────

export async function listRuns(collegeId: string, page = 1, limit = 20, definitionCode?: string) {
  const filter: Record<string, unknown> = { collegeId };
  if (definitionCode) filter.definitionCode = definitionCode;
  return paginate(ReportRun, filter, page, limit, { createdAt: -1 });
}

export async function getRun(collegeId: string, id: string) {
  const doc = await ReportRun.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Report run not found');
  return doc;
}

const ROW_CAP = 5000;

export async function runReport(
  collegeId: string,
  code: string,
  parameters: Record<string, unknown>,
  requestedBy: string,
): Promise<IReportRun> {
  const def = getDefinition(code);

  // Persist the run record up-front so even crashes leave an audit trail.
  const runDoc = await ReportRun.create({
    collegeId,
    definitionCode: code,
    parameters,
    status: 'running',
    requestedBy,
    executedAt: new Date(),
    resultCount: 0,
  });

  const started = Date.now();
  try {
    const out = await def.run({ collegeId }, parameters);
    const truncated = (out.rows || []).slice(0, ROW_CAP);

    runDoc.status = 'success';
    runDoc.result = truncated;
    runDoc.resultCount = truncated.length;
    runDoc.summary = out.summary;
    runDoc.durationMs = Date.now() - started;
    await runDoc.save();
  } catch (e: unknown) {
    runDoc.durationMs = Date.now() - started;
    if (e instanceof PhaseBStubError) {
      runDoc.status = 'unimplemented';
      runDoc.unimplementedReason = e.message;
    } else {
      runDoc.status = 'failed';
      runDoc.error = e instanceof Error ? e.message : String(e);
    }
    await runDoc.save();
  }

  await createAuditLog({
    collegeId,
    entityType: 'ReportRun',
    entityId: String(runDoc._id),
    entityName: def.label,
    action: 'create',
    changes: [],
    performedBy: requestedBy,
  });

  return runDoc;
}
