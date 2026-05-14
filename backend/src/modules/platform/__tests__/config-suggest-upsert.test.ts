import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import { upsertConfigEntry } from '../config-service';
import { ConfigSuggestion } from '../../../models/platform/ConfigSuggestion';
import { ConfigEntry } from '../../../models/platform/ConfigEntry';
import { AuditLog } from '../../../shared/audit';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

/**
 * 002-ai-assisted-config Task 4.3 — extended upsert with aiAcceptedFields.
 *
 * End-to-end: a config save that came partly from AI suggestions:
 *   - audit `changes` carries `source: 'ai'` on accepted fields and
 *     `source: 'ui'` on the rest.
 *   - matching suggestions flip to 'accepted'; the other suggestions
 *     in the same batch flip to 'rejected'.
 *   - a parallel `ai_config_applied` audit log is written.
 */

const oid = () => new mongoose.Types.ObjectId();

describe('upsertConfigEntry — aiAcceptedFields flow', () => {
  beforeAll(async () => {
    await setupMongo();
    await ConfigSuggestion.syncIndexes();
    await ConfigEntry.syncIndexes();
  }, 60_000);
  afterAll(async () => { await teardownMongo(); }, 30_000);
  afterEach(async () => { await clearCollections(); });

  it('stamps source:ai on accepted fields and source:ui on the rest', async () => {
    const collegeId = String(oid());
    const batchId = 'batch-upsert-1';
    // Pre-seed two suggestions
    await ConfigSuggestion.create([
      { collegeId: new mongoose.Types.ObjectId(collegeId), configType: 'institution-feature-flags', field: 'emailNotifications', suggestedValue: true, confidence: 0.9, rationale: 'r', source: 'llm', generatedAt: new Date(), llmModel: 'm', promptVersion: 'p', costInr: 0.5, batchId },
      { collegeId: new mongoose.Types.ObjectId(collegeId), configType: 'institution-feature-flags', field: 'smsNotifications', suggestedValue: true, confidence: 0.8, rationale: 'r', source: 'llm', generatedAt: new Date(), llmModel: 'm', promptVersion: 'p', costInr: 0.5, batchId },
    ]);

    await upsertConfigEntry(
      collegeId,
      'institution-feature-flags',
      {
        values: { emailNotifications: true, smsNotifications: false, whatsappNotifications: true },
        aiAcceptedFields: ['emailNotifications'],
        batchId,
      },
      'user-1',
    );

    // Audit log for the create/update has provenance
    const upsertAudit = await AuditLog.findOne({ entityType: 'ConfigEntry', action: { $in: ['create', 'update'] } }).lean();
    expect(upsertAudit).toBeDefined();
    const bySource = Object.fromEntries(upsertAudit!.changes.map((c) => [c.field, c.source]));
    expect(bySource.emailNotifications).toBe('ai');
    expect(bySource.smsNotifications).toBe('ui');

    // Suggestions reconciled
    const suggestionDocs = await ConfigSuggestion.find({ batchId }).lean();
    const byField = Object.fromEntries(suggestionDocs.map((d) => [d.field, d.status]));
    expect(byField.emailNotifications).toBe('accepted');
    expect(byField.smsNotifications).toBe('rejected');

    // Parallel ai_config_applied audit entry
    const applied = await AuditLog.findOne({ action: 'ai_config_applied' }).lean();
    expect(applied).toBeDefined();
    expect(applied!.performedBy).toBe('user-1');
  });

  it('plain upsert without aiAcceptedFields skips the AI side-effects', async () => {
    const collegeId = String(oid());
    await upsertConfigEntry(
      collegeId,
      'institution-feature-flags',
      { values: { emailNotifications: false } },
      'user-1',
    );
    const applied = await AuditLog.findOne({ action: 'ai_config_applied' }).lean();
    expect(applied).toBeNull();
    // No `changes` provenance when no AI fields involved
    const upsertAudit = await AuditLog.findOne({ entityType: 'ConfigEntry' }).lean();
    expect(upsertAudit!.changes).toEqual([]);
  });
});
