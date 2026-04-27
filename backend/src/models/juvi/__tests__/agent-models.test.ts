import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose, { Types } from 'mongoose';

import { AgentConversation } from '../AgentConversation';
import { AgentAction } from '../AgentAction';
import { SituationDismissal } from '../SituationDismissal';
import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';

/**
 * Task A2 — fee-analytics-ai-native: new Mongoose models.
 *
 * Covers spec/plan §2.1 (schemas) and §2.2 (compound indexes) for the three
 * new collections that back the AI-native finance agent: AgentConversation,
 * AgentAction, SituationDismissal.
 *
 * Pattern note: none of the three interfaces extend mongoose's `Document`
 * — the base class has built-in fields that clash with our domain field
 * names (e.g. `errors` on AgentAction's reverted sub-doc context, or simply
 * for symmetry with FeeAlertsCronRun which had the same problem). We use
 * plain TS interfaces + `model<T>()` per the modern Mongoose-8 idiom.
 */

const oid = () => new Types.ObjectId();

describe('Task A2 — agent models (juvi/finance-agent)', () => {
  beforeAll(async () => {
    await setupMongo();
    await Promise.all([
      AgentConversation.syncIndexes(),
      AgentAction.syncIndexes(),
      SituationDismissal.syncIndexes(),
    ]);
  }, 60_000);
  afterAll(async () => {
    await teardownMongo();
  }, 30_000);
  afterEach(async () => {
    await clearCollections();
  });

  // ────────────────────────────────────────────────────────────────────────
  // AgentConversation
  // ────────────────────────────────────────────────────────────────────────
  describe('AgentConversation', () => {
    const baseDoc = () => ({
      collegeId: oid(),
      userId: oid(),
      conversationId: 'conv-uuid-1',
      lastModel: 'claude-sonnet-4-5',
      lastProvider: 'claude' as const,
    });

    it('AC1: creates a valid doc with the minimum required fields', async () => {
      const doc = await AgentConversation.create(baseDoc());
      expect(doc._id).toBeDefined();
      expect(doc.turns).toEqual([]);
      expect(doc.totalInputTokens).toBe(0);
      expect(doc.totalOutputTokens).toBe(0);
      expect(doc.totalCostInr).toBe(0);
      // timestamps applied
      expect(doc.createdAt).toBeInstanceOf(Date);
      expect(doc.updatedAt).toBeInstanceOf(Date);
    });

    it('AC2: rejects creation when collegeId is missing', async () => {
      const { collegeId: _omit, ...rest } = baseDoc();
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        AgentConversation.create(rest as any),
      ).rejects.toThrow();
    });

    it('AC3: turns array accepts multiple role-tagged entries', async () => {
      const doc = await AgentConversation.create({
        ...baseDoc(),
        turns: [
          { role: 'user', content: 'Hi', timestamp: new Date() },
          { role: 'assistant', content: 'Hello', timestamp: new Date() },
          { role: 'user', content: 'What is overdue today?', timestamp: new Date() },
        ],
      });
      expect(doc.turns).toHaveLength(3);
      expect(doc.turns[0]!.role).toBe('user');
      expect(doc.turns[1]!.role).toBe('assistant');
      expect(doc.turns[2]!.content).toBe('What is overdue today?');
    });

    it('AC4: lastProvider enum validation rejects unknown providers', async () => {
      await expect(
        AgentConversation.create({
          ...baseDoc(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          lastProvider: 'bedrock' as any,
        }),
      ).rejects.toThrow();
    });

    it("AC4: lastProvider accepts both 'claude' and 'openai'", async () => {
      const a = await AgentConversation.create({ ...baseDoc(), conversationId: 'a', lastProvider: 'claude' });
      const b = await AgentConversation.create({ ...baseDoc(), conversationId: 'b', lastProvider: 'openai' });
      expect(a.lastProvider).toBe('claude');
      expect(b.lastProvider).toBe('openai');
    });

    it('declares compound index { collegeId:1, userId:1, updatedAt:-1 }', async () => {
      const indexes = await AgentConversation.collection.indexes();
      const found = indexes.some((ix) => {
        const k = ix.key as Record<string, number>;
        return (
          k.collegeId === 1 &&
          k.userId === 1 &&
          k.updatedAt === -1 &&
          Object.keys(k).length === 3
        );
      });
      expect(found).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // AgentAction
  // ────────────────────────────────────────────────────────────────────────
  describe('AgentAction', () => {
    const baseDoc = () => ({
      collegeId: oid(),
      userId: oid(),
      type: 'chat' as const,
      maskedPrompt: 'Why is {student_name_1} overdue?',
      maskedResponse: 'Because {student_name_1} skipped stage_2 reminders.',
      provider: 'claude' as const,
      model: 'claude-sonnet-4-5',
      durationMs: 1824,
      inputTokens: 523,
      outputTokens: 147,
      costInr: 0.18,
    });

    it('AC5: creates a valid doc with the minimum required fields', async () => {
      const doc = await AgentAction.create(baseDoc());
      expect(doc._id).toBeDefined();
      expect(doc.type).toBe('chat');
      expect(doc.reverted).toBeUndefined();
      expect(doc.createdAt).toBeInstanceOf(Date);
    });

    it('AC6: rejects creation when collegeId is missing', async () => {
      const { collegeId: _omit, ...rest } = baseDoc();
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        AgentAction.create(rest as any),
      ).rejects.toThrow();
    });

    it('AC7: type enum accepts all 7 documented values', async () => {
      const types = [
        'chat',
        'forecast',
        'risk',
        'situations',
        'reminder-draft',
        'reminder-approve',
        'situation-dismiss',
      ] as const;
      for (const t of types) {
        const doc = await AgentAction.create({ ...baseDoc(), type: t });
        expect(doc.type).toBe(t);
      }
    });

    it('AC7: type enum rejects unknown values', async () => {
      await expect(
        AgentAction.create({
          ...baseDoc(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type: 'unknown-action' as any,
        }),
      ).rejects.toThrow();
    });

    it('AC8: reverted optional sub-doc round-trips with at/by/reason', async () => {
      const reverter = oid();
      const at = new Date();
      const doc = await AgentAction.create({
        ...baseDoc(),
        type: 'reminder-approve',
        reverted: { at, by: reverter, reason: 'Officer recalled within 5min window' },
      });
      expect(doc.reverted).toBeDefined();
      expect(doc.reverted?.at).toBeInstanceOf(Date);
      expect(doc.reverted?.at.getTime()).toBe(at.getTime());
      expect(String(doc.reverted?.by)).toBe(String(reverter));
      expect(doc.reverted?.reason).toBe('Officer recalled within 5min window');
      // Sub-doc must not have its own _id (per spec — `_id: false`)
      const plain = doc.toObject();
      const reverted = plain.reverted as unknown as Record<string, unknown>;
      expect(reverted._id).toBeUndefined();
    });

    it('declares compound index { collegeId:1, createdAt:-1 }', async () => {
      const indexes = await AgentAction.collection.indexes();
      const found = indexes.some((ix) => {
        const k = ix.key as Record<string, number>;
        return (
          k.collegeId === 1 &&
          k.createdAt === -1 &&
          Object.keys(k).length === 2
        );
      });
      expect(found).toBe(true);
    });

    it('declares compound index { userId:1, createdAt:-1 }', async () => {
      const indexes = await AgentAction.collection.indexes();
      const found = indexes.some((ix) => {
        const k = ix.key as Record<string, number>;
        return (
          k.userId === 1 &&
          k.createdAt === -1 &&
          Object.keys(k).length === 2
        );
      });
      expect(found).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // SituationDismissal
  // ────────────────────────────────────────────────────────────────────────
  describe('SituationDismissal', () => {
    const baseDoc = () => ({
      collegeId: oid(),
      userId: oid(),
      situationFingerprint: 'sha256:partial-payment-stale:abc123',
      snoozedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      reason: 'Already on a payment plan',
    });

    it('AC9: creates a valid doc with the minimum required fields', async () => {
      const doc = await SituationDismissal.create(baseDoc());
      expect(doc._id).toBeDefined();
      expect(doc.situationFingerprint).toBe('sha256:partial-payment-stale:abc123');
      expect(doc.snoozedUntil).toBeInstanceOf(Date);
      expect(doc.createdAt).toBeInstanceOf(Date);
    });

    it('AC10: rejects when collegeId is missing', async () => {
      const { collegeId: _omit, ...rest } = baseDoc();
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        SituationDismissal.create(rest as any),
      ).rejects.toThrow();
    });

    it('AC10: rejects when situationFingerprint is missing', async () => {
      const { situationFingerprint: _omit, ...rest } = baseDoc();
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        SituationDismissal.create(rest as any),
      ).rejects.toThrow();
    });

    it('AC10: rejects when snoozedUntil is missing', async () => {
      const { snoozedUntil: _omit, ...rest } = baseDoc();
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        SituationDismissal.create(rest as any),
      ).rejects.toThrow();
    });

    it('AC10: accepts empty string reason but rejects null', async () => {
      // Empty string allowed
      const empty = await SituationDismissal.create({ ...baseDoc(), reason: '' });
      expect(empty.reason).toBe('');

      // null rejected
      await expect(
        SituationDismissal.create({
          ...baseDoc(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          reason: null as any,
        }),
      ).rejects.toThrow();
    });

    it('AC11: declares compound index { collegeId:1, userId:1, snoozedUntil:1 }', async () => {
      const indexes = await SituationDismissal.collection.indexes();
      const found = indexes.some((ix) => {
        const k = ix.key as Record<string, number>;
        return (
          k.collegeId === 1 &&
          k.userId === 1 &&
          k.snoozedUntil === 1 &&
          Object.keys(k).length === 3
        );
      });
      expect(found).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Cross-cutting — tenant isolation (AC12)
  // ────────────────────────────────────────────────────────────────────────
  describe('AC12: cross-college isolation via collegeId', () => {
    it('AgentConversation written under college A is invisible when filtering by college B', async () => {
      const collegeA = oid();
      const collegeB = oid();
      const userId = oid();
      await AgentConversation.create({
        collegeId: collegeA,
        userId,
        conversationId: 'A-1',
        lastModel: 'claude-sonnet-4-5',
        lastProvider: 'claude',
      });
      const seenFromA = await AgentConversation.find({ collegeId: collegeA });
      const seenFromB = await AgentConversation.find({ collegeId: collegeB });
      expect(seenFromA).toHaveLength(1);
      expect(seenFromB).toHaveLength(0);
    });

    it('AgentAction is college-scoped on read', async () => {
      const collegeA = oid();
      const collegeB = oid();
      const userId = oid();
      await AgentAction.create({
        collegeId: collegeA,
        userId,
        type: 'forecast',
        maskedPrompt: 'p',
        maskedResponse: 'r',
        provider: 'openai',
        model: 'gpt-4o-mini',
        durationMs: 100,
        inputTokens: 10,
        outputTokens: 5,
        costInr: 0.01,
      });
      const seenFromA = await AgentAction.find({ collegeId: collegeA });
      const seenFromB = await AgentAction.find({ collegeId: collegeB });
      expect(seenFromA).toHaveLength(1);
      expect(seenFromB).toHaveLength(0);
    });

    it('SituationDismissal is college-scoped on read', async () => {
      const collegeA = oid();
      const collegeB = oid();
      const userId = oid();
      await SituationDismissal.create({
        collegeId: collegeA,
        userId,
        situationFingerprint: 'fp-A',
        snoozedUntil: new Date(Date.now() + 86_400_000),
        reason: 'snoozed',
      });
      const seenFromA = await SituationDismissal.find({ collegeId: collegeA });
      const seenFromB = await SituationDismissal.find({ collegeId: collegeB });
      expect(seenFromA).toHaveLength(1);
      expect(seenFromB).toHaveLength(0);
    });
  });

  // Sanity: ObjectIds get normalized via String()
  it('String(doc._id) yields a string for all three models', async () => {
    const conv = await AgentConversation.create({
      collegeId: oid(),
      userId: oid(),
      conversationId: 'sanity-1',
      lastModel: 'gpt-4o-mini',
      lastProvider: 'openai',
    });
    const act = await AgentAction.create({
      collegeId: oid(),
      userId: oid(),
      type: 'risk',
      maskedPrompt: 'p',
      maskedResponse: 'r',
      provider: 'claude',
      model: 'claude-sonnet-4-5',
      durationMs: 1,
      inputTokens: 1,
      outputTokens: 1,
      costInr: 0,
    });
    const dis = await SituationDismissal.create({
      collegeId: oid(),
      userId: oid(),
      situationFingerprint: 'fp-sanity',
      snoozedUntil: new Date(Date.now() + 1000),
      reason: '',
    });
    expect(typeof String(conv._id)).toBe('string');
    expect(typeof String(act._id)).toBe('string');
    expect(typeof String(dis._id)).toBe('string');
    expect(mongoose.Types.ObjectId.isValid(String(conv._id))).toBe(true);
  });
});
