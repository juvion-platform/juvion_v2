import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import { AuditLog, createAuditLog } from '../audit';
import { setupMongo, teardownMongo, clearCollections } from '../../__tests__/helpers/mongoMemory';

/**
 * 011-account-deletion Task 2 — the `request_deletion` audit action.
 *
 * The audit action set is doubly closed: the `AuditAction` union in
 * `shared/types.ts` and the `AUDIT_ACTIONS` enum mirror in `shared/audit.ts`.
 * Adding a member to only one half is a compile error on one side and a
 * runtime ValidationError on the other. This test pins the persisted half.
 */

describe('audit request_deletion action', () => {
  beforeAll(async () => { await setupMongo(); }, 60_000);
  afterAll(async () => { await teardownMongo(); }, 30_000);
  afterEach(async () => { await clearCollections(); });

  it('persists a request_deletion entry (011 T2)', async () => {
    const collegeId = String(new mongoose.Types.ObjectId());
    await createAuditLog({
      collegeId,
      entityType: 'JuviAccountPublicDeletion',
      entityId: 'acct-1',
      entityName: '21CS1042',
      action: 'request_deletion',
      changes: [],
      performedBy: 'acct-1',
    });

    const log = await AuditLog.findOne({ action: 'request_deletion' }).lean();
    expect(log).toBeDefined();
    expect(log!.entityType).toBe('JuviAccountPublicDeletion');
    expect(log!.collegeId.toString()).toBe(collegeId);
  });
});
