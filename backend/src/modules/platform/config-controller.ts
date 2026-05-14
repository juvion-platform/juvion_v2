/**
 * config-controller — HTTP layer for the schema-driven runtime
 * configuration surface (Strategic Gap 3 Phase A). Endpoints are
 * mounted under /api/platform/config/* in `routes.ts`.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as configService from './config-service';

export async function listTypesHandler(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json(configService.listConfigTypes());
  } catch (e) { next(e); }
}

export async function getSchemaHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { type } = req.params as { type: string };
    res.json(configService.getConfigSchema(type));
  } catch (e) { next(e); }
}

export async function listEntriesHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { type } = req.params as { type: string };
    const entries = await configService.listConfigEntries(req.collegeId!, type);
    res.json({ entries });
  } catch (e) { next(e); }
}

export async function getEntryHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { type, identifier } = req.params as { type: string; identifier?: string };
    const entry = await configService.getConfigEntry(req.collegeId!, type, identifier);
    res.json(entry);
  } catch (e) { next(e); }
}

/**
 * Upsert. Routes are wired so that both
 *   PUT /config/:type
 *   PUT /config/:type/:identifier
 * land here. For single-cardinality types the identifier is ignored.
 */
export async function upsertEntryHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { type, identifier } = req.params as { type: string; identifier?: string };
    const { values, label, enabled } = req.body as {
      values: Record<string, unknown>;
      label?: string;
      enabled?: boolean;
    };
    const doc = await configService.upsertConfigEntry(
      req.collegeId!,
      type,
      { values: values || {}, identifier, label, enabled },
      req.user?.name || 'unknown',
    );
    res.json(doc);
  } catch (e) { next(e); }
}

export async function deleteEntryHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { type, identifier } = req.params as { type: string; identifier: string };
    const result = await configService.deleteConfigEntry(
      req.collegeId!,
      type,
      identifier,
      req.user?.name || 'unknown',
    );
    res.json(result);
  } catch (e) { next(e); }
}

// ─── Strategic Gap 8 — ERPNext / Frappe HR bridge ─────────────────
import * as bridge from './erpnext-bridge';

export async function getERPNextStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json(await bridge.getBridgeStatus(req.collegeId!));
  } catch (e) { next(e); }
}

export async function updateERPNextConfig(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const cfg = await bridge.updateBridgeConfig(
      req.collegeId!,
      req.body,
      req.user?.name || 'unknown',
    );
    res.json(cfg);
  } catch (e) { next(e); }
}

export async function testERPNextConnection(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json(await bridge.testConnection(req.collegeId!));
  } catch (e) { next(e); }
}
