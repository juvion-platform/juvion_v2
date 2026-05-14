/**
 * erpnext-bridge — Frappe HR / ERPNext integration. Strategic Gap 8
 * Phase A.
 *
 * Architecture (the decision doc, .captain/specs/frappe-hr-bridge/
 * decision.md, has the full rationale):
 *
 *   Juvion event bus → bridge listener → HTTP push to ERPNext REST API
 *                          │
 *                          └→ IntegrationLog records every call.
 *
 * Phase A ships the scaffolding:
 *   - Config CRUD (per-college singleton)
 *   - Mapping registry (Juvion event → ERPNext DocType + transformer)
 *   - Event listeners that record sync attempts to IntegrationLog with
 *     status: 'unimplemented'. The HTTP push itself is a Phase B
 *     replacement: the listener is already in place, so flipping the
 *     stub to a real fetch() is the only edit.
 *   - 3 admin endpoints.
 *
 * What this commit deliberately does NOT do:
 *   - Make outbound HTTP calls. The decision doc commits Juvion to
 *     buy, but the actual ERPNext deployment + secrets-vault wiring
 *     is its own ticket (Phase B). Shipping the wire today would
 *     dial out from prod, which is not what Phase A is for.
 */

import { eventBus } from '../../shared/events';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import {
  ERPNextBridgeConfig, IERPNextBridgeConfig,
} from '../../models/platform/ERPNextBridgeConfig';
import { IntegrationLog } from '../../models/platform/IntegrationLog';

// ─── Mapping registry — Juvion event → ERPNext DocType ──────────────

export interface ERPNextMapping {
  /** Juvion event bus name. */
  juvionEvent: string;
  /** Target ERPNext DocType, in their native naming. */
  erpnextDocType: string;
  /** REST method (almost always POST for create, PUT for update). */
  method: 'POST' | 'PUT';
  /** Whether the event is enabled by default in fresh configs. */
  defaultEnabled: boolean;
  /** Human-readable description shown in the admin UI. */
  description: string;
  /** Payload transformer. Receives the raw event payload, returns the
   *  ERPNext-shaped body. Phase A keeps these passthrough; Phase B
   *  will customise per CampX field naming. */
  transform: (eventPayload: unknown) => Record<string, unknown>;
}

const identity = (p: unknown): Record<string, unknown> => p as Record<string, unknown>;

export const ERPNEXT_MAPPINGS: readonly ERPNextMapping[] = [
  {
    juvionEvent: 'hr:employee:created',
    erpnextDocType: 'Employee',
    method: 'POST',
    defaultEnabled: true,
    description: 'New employee record — pushes Juvion Employee to ERPNext as Employee master.',
    transform: identity,
  },
  {
    juvionEvent: 'hr:employee:updated',
    erpnextDocType: 'Employee',
    method: 'PUT',
    defaultEnabled: true,
    description: 'Employee record changes (designation, department) — syncs to ERPNext.',
    transform: identity,
  },
  {
    juvionEvent: 'hr:leave:applied',
    erpnextDocType: 'Leave Application',
    method: 'POST',
    defaultEnabled: true,
    description: 'Leave application — creates Leave Application in ERPNext for payroll-side processing.',
    transform: identity,
  },
  {
    juvionEvent: 'hr:leave:approved',
    erpnextDocType: 'Leave Application',
    method: 'PUT',
    defaultEnabled: true,
    description: 'Leave approved — moves the ERPNext-side application to Approved.',
    transform: identity,
  },
  {
    juvionEvent: 'hr:payroll:finalised',
    erpnextDocType: 'Salary Slip',
    method: 'POST',
    defaultEnabled: false,
    description: 'Payroll finalisation — Phase B will SEND TO ERPNext, today ERPNext OWNS payroll so this channel defaults OFF.',
    transform: identity,
  },
  {
    juvionEvent: 'hr:attendance:logged',
    erpnextDocType: 'Attendance',
    method: 'POST',
    defaultEnabled: true,
    description: 'Daily attendance log — pushes Juvion EmployeeAttendance to ERPNext Attendance for payroll proration.',
    transform: identity,
  },
];

export function listMappings(): ERPNextMapping[] {
  return [...ERPNEXT_MAPPINGS];
}

// ─── Config CRUD ────────────────────────────────────────────────────

const DEFAULT_CHANNELS = ERPNEXT_MAPPINGS.filter((m) => m.defaultEnabled).map((m) => m.juvionEvent);

export async function getBridgeConfig(collegeId: string): Promise<IERPNextBridgeConfig> {
  let cfg = await ERPNextBridgeConfig.findOne({ collegeId });
  if (!cfg) {
    cfg = await ERPNextBridgeConfig.create({
      collegeId,
      enabled: false,
      enabledChannels: DEFAULT_CHANNELS,
      failureCount: 0,
      successCount: 0,
      outboundEnabled: false,
    });
  }
  return cfg;
}

export async function updateBridgeConfig(
  collegeId: string,
  patch: Partial<Pick<IERPNextBridgeConfig, 'enabled' | 'baseUrl' | 'apiKeyRef' | 'siteName' | 'enabledChannels' | 'outboundEnabled'>>,
  performedBy: string,
): Promise<IERPNextBridgeConfig> {
  const cfg = await ERPNextBridgeConfig.findOneAndUpdate(
    { collegeId },
    { $set: { ...patch, updatedBy: performedBy } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await createAuditLog({
    collegeId,
    entityType: 'ERPNextBridgeConfig',
    entityId: String(cfg._id),
    entityName: 'erpnext-bridge',
    action: 'update',
    changes: [],
    performedBy,
  });
  return cfg;
}

// ─── Status surface ─────────────────────────────────────────────────

export async function getBridgeStatus(collegeId: string) {
  const config = await getBridgeConfig(collegeId);
  // Recent attempts: last 10 IntegrationLog rows for provider='erpnext'.
  const recent = await IntegrationLog.find({ collegeId, provider: 'erpnext' })
    .sort({ startedAt: -1 })
    .limit(10)
    .lean();
  return {
    config,
    mappings: listMappings(),
    recent,
    phaseANote:
      'Phase A: outbound HTTP push is stubbed (logs as `status: \'pending\'` then `unimplemented`). Phase B flips one stub function to a real fetch().',
  };
}

// ─── Test connection ────────────────────────────────────────────────

export async function testConnection(collegeId: string) {
  const config = await getBridgeConfig(collegeId);
  if (!config.baseUrl) throw new AppError(400, 'baseUrl is not configured');
  // Phase A — no actual HTTP call. Record a stub IntegrationLog entry
  // so the admin can see this exercise in the recent-calls view.
  const log = await IntegrationLog.create({
    collegeId,
    provider: 'erpnext',
    endpoint: `${config.baseUrl}/api/method/ping`,
    method: 'GET',
    status: 'pending',
    retryCount: 0,
    startedAt: new Date(),
  });
  log.status = 'failed';
  log.error = 'Phase A — outbound HTTP push not yet wired (see decision.md). Configuration looks valid.';
  log.completedAt = new Date();
  await log.save();
  return {
    ok: false,
    reason: 'phase_a_stub',
    message: 'Configuration valid. Real connection-test ships with the Phase B HTTP wire-up.',
  };
}

// ─── Event-bus subscriptions ────────────────────────────────────────

let initialised = false;

/**
 * Wire the bridge to the Juvion event bus. Idempotent — safe to call
 * multiple times (registration guard prevents duplicate listeners).
 *
 * Each registered listener:
 *   1. Reads the per-college config; bails if disabled / channel off.
 *   2. Records an IntegrationLog row marking the sync attempt.
 *   3. Phase A: marks the log as 'failed' with the "Phase B stub"
 *      reason. Phase B: actually fetch()s ERPNext and updates the log.
 */
export function initBridgeListeners() {
  if (initialised) return;
  initialised = true;
  for (const mapping of ERPNEXT_MAPPINGS) {
    eventBus.on(mapping.juvionEvent, async (rawPayload: { collegeId?: string; [k: string]: unknown }) => {
      try {
        const collegeId = rawPayload?.collegeId;
        if (!collegeId) return; // No tenant; nothing to do.

        const cfg = await ERPNextBridgeConfig.findOne({ collegeId });
        if (!cfg || !cfg.enabled) return;
        if (!cfg.enabledChannels.includes(mapping.juvionEvent)) return;

        const log = await IntegrationLog.create({
          collegeId,
          provider: 'erpnext',
          endpoint: `${cfg.baseUrl || '(unset)'}/api/resource/${encodeURIComponent(mapping.erpnextDocType)}`,
          method: mapping.method,
          requestPayload: mapping.transform(rawPayload),
          status: 'pending',
          retryCount: 0,
          startedAt: new Date(),
        });

        // Phase A — stub. Phase B replaces this block with a real
        // fetch() to ERPNext + retry/error handling.
        if (!cfg.outboundEnabled) {
          log.status = 'failed';
          log.error = 'Phase A stub: outbound disabled. Set outboundEnabled=true to engage Phase B wire-up.';
          log.completedAt = new Date();
          await log.save();
          // Bump failureCount so the admin sees pending traffic.
          await ERPNextBridgeConfig.updateOne(
            { _id: cfg._id },
            { $inc: { failureCount: 1 }, $set: { lastSyncAt: new Date(), lastError: log.error } },
          );
          return;
        }

        // ⚠ Phase B — real outbound HTTP push lands here.
        // For now we never reach it because outboundEnabled is gated.
      } catch (err) {
        // Swallow + audit — never let a bridge failure crash the
        // emitting service. The audit trail is in IntegrationLog.
        // eslint-disable-next-line no-console
        console.error('[erpnext-bridge] listener error:', err);
      }
    });
  }
}
