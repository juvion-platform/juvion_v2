import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import { AuditLog, createAuditLog } from '../audit';
import { setupMongo, teardownMongo, clearCollections } from '../../__tests__/helpers/mongoMemory';

/**
 * 002-ai-assisted-config Task 1.1 — `FieldChange.source` round-trips.
 *
 * The audit schema's `changes` subdoc gains a `source: String` field. This
 * test pins the round-trip so a future "clean up the audit schema" PR
 * can't silently drop it.
 */

describe('audit FieldChange.source', () => {
  beforeAll(async () => { await setupMongo(); }, 60_000);
  afterAll(async () => { await teardownMongo(); }, 30_000);
  afterEach(async () => { await clearCollections(); });

  it('persists source on changes (ai / ui / import)', async () => {
    const collegeId = String(new mongoose.Types.ObjectId());
    await createAuditLog({
      collegeId,
      entityType: 'ConfigEntry',
      entityId: 'fake-id',
      entityName: 'institution-feature-flags',
      action: 'update',
      changes: [
        { field: 'enableEmail', displayName: 'Email enabled', oldValue: false, newValue: true, source: 'ai' },
        { field: 'enableSMS', displayName: 'SMS enabled', oldValue: false, newValue: true, source: 'ui' },
        { field: 'enableWhatsApp', displayName: 'WhatsApp enabled', oldValue: false, newValue: true, source: 'import' },
        { field: 'enablePortal', displayName: 'Parent portal', oldValue: false, newValue: true }, // no source — back-compat
      ],
      performedBy: 'user-1',
    });

    const log = await AuditLog.findOne({ entityType: 'ConfigEntry' }).lean();
    expect(log).toBeDefined();
    expect(log!.changes).toHaveLength(4);
    expect(log!.changes[0]?.source).toBe('ai');
    expect(log!.changes[1]?.source).toBe('ui');
    expect(log!.changes[2]?.source).toBe('import');
    expect(log!.changes[3]?.source).toBeUndefined();
  });

  it('accepts both the new AI audit actions', async () => {
    const collegeId = String(new mongoose.Types.ObjectId());
    await createAuditLog({
      collegeId,
      entityType: 'ConfigEntry',
      entityId: 'x',
      entityName: 'institution-feature-flags',
      action: 'ai_config_suggested',
      changes: [],
      performedBy: 'user-2',
    });
    await createAuditLog({
      collegeId,
      entityType: 'ConfigEntry',
      entityId: 'x',
      entityName: 'institution-feature-flags',
      action: 'ai_config_applied',
      changes: [],
      performedBy: 'user-2',
    });
    const logs = await AuditLog.find({ entityType: 'ConfigEntry' }).lean();
    expect(logs).toHaveLength(2);
    const actions = logs.map((l) => l.action).sort();
    expect(actions).toEqual(['ai_config_applied', 'ai_config_suggested']);
  });
});
