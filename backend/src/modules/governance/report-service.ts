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
import type { AuthScope } from '../../shared/rbac/types';

/**
 * 004-rbac-nl-queries §10.10 — refusal signal when a (report, authScope)
 * pair is incompatible. Thrown by the eligibility gate inside `runReport`
 * BEFORE any side effect (no ReportRun created, no audit log, no runner
 * invocation). The NL service catches this and converts to a
 * `report-not-scopable-for-role` or `scope-unresolved` refused response.
 */
export class ScopeNotSupportedError extends Error {
  constructor(
    public readonly reportCode: string,
    public readonly dimension: 'department' | 'self',
    public readonly kind: 'role-not-eligible' | 'scope-unresolved',
  ) {
    super(`Report '${reportCode}' is not scopable for ${dimension} (${kind})`);
    this.name = 'ScopeNotSupportedError';
  }
}

/**
 * 004-rbac-nl-queries §3 — admin-equivalent scope sentinel. Pass this
 * when invoking `runReport` from an admin-gated path (e.g., the REST
 * `/reports/run/:code` endpoint still behind `requireRole`) or when the
 * caller has not yet been migrated to thread `req.authScope`.
 *
 * Both `departmentOnly` and `selfOnly` are false → `applyAuthScope` is a
 * no-op inside the runner → the runner sees admin-equivalent semantics.
 */
export const ADMIN_FULL_SCOPE: AuthScope = Object.freeze({
  departmentOnly: false,
  selfOnly: false,
  userId: 'admin-sentinel',
  resolvedPermissions: [],
}) as AuthScope;

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
  authScope: AuthScope,
): Promise<IReportRun> {
  const def = getDefinition(code);

  // 004 §10.10 — eligibility gate. Fires BEFORE any side effect.
  // Order is deterministic: admin-only mismatch checks first (cheaper, no
  // discriminator dependency), then scope-unresolved checks. Once any
  // branch throws, no ReportRun row is created, no runner is invoked, no
  // audit log is written.
  if (authScope.departmentOnly && def.scopeEligibility.departmentOnly === 'admin-only') {
    throw new ScopeNotSupportedError(code, 'department', 'role-not-eligible');
  }
  if (authScope.selfOnly && def.scopeEligibility.selfOnly === 'admin-only') {
    throw new ScopeNotSupportedError(code, 'self', 'role-not-eligible');
  }
  if (authScope.departmentOnly && !authScope.departmentId) {
    throw new ScopeNotSupportedError(code, 'department', 'scope-unresolved');
  }
  if (authScope.selfOnly && !authScope.userId) {
    throw new ScopeNotSupportedError(code, 'self', 'scope-unresolved');
  }

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
    const out = await def.run({ collegeId, authScope }, parameters);
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
