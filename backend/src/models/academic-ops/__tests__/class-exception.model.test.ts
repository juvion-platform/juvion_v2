import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest';
import { ClassException, LeanClassException } from '../ClassException';
import { Types } from 'mongoose';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

const cid = () => new Types.ObjectId();

function valid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    collegeId: cid(),
    timetableSlotId: cid(),
    courseOfferingId: cid(),
    date: '2026-10-15',
    type: 'cancelled',
    reason: 'Faculty on university duty',
    createdBy: new Types.ObjectId('000000000000000000000001'),
    ...overrides,
  };
}

// The duplicate-key assertion below depends on the unique partial index
// ({ timetableSlotId, date } where revokedAt is null). Mongoose builds indexes in the
// background after connect, so on a loaded machine the build can still be in flight when
// the second insert fires and the duplicate is accepted. syncIndexes() awaits it — the
// same guard student-rollnumber-index and fee-structure-uniqueness already use (R51).
beforeAll(async () => { await setupMongo(); await ClassException.syncIndexes(); });
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); });

describe('ClassException', () => {
  it('stores a cancelled row', async () => {
    const row = await ClassException.create(valid());
    expect(String(row._id)).toBeTruthy();
    expect(row.date).toBe('2026-10-15');
    expect(row.type).toBe('cancelled');
    expect(row.revokedAt).toBeNull();
  });

  it('requires newDate/newStartTime/newEndTime for reschedules', async () => {
    await expect(ClassException.create(valid({ type: 'rescheduled' }))).rejects.toThrow(/newDate/);
    await expect(ClassException.create(valid({
      type: 'rescheduled', newDate: '2026-10-17', newStartTime: '10:00',
    }))).rejects.toThrow(/newEndTime/);
    const ok = await ClassException.create(valid({
      type: 'rescheduled', newDate: '2026-10-17', newStartTime: '10:00', newEndTime: '11:00',
    }));
    expect(ok.newDate).toBe('2026-10-17');
  });

  it('rejects a reason shorter than 5 characters', async () => {
    await expect(ClassException.create(valid({ reason: 'nope' }))).rejects.toThrow();
  });

  it('enforces one ACTIVE exception per (slot, date) but allows revoked alongside', async () => {
    const base = valid();
    await ClassException.create(base);
    await expect(ClassException.create(base)).rejects.toThrow(/duplicate key/);
    // Revoke the first, then the second create must succeed.
    const first = await ClassException.findOne({ date: '2026-10-15' }).lean<LeanClassException | null>();
    expect(first).not.toBeNull();
    await ClassException.updateOne({ _id: first!._id }, { $set: { revokedAt: new Date(), revokedBy: new Types.ObjectId('000000000000000000000002') } });
    await expect(ClassException.create(base)).resolves.toBeTruthy();
  });
});
