import { Types } from 'mongoose';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const deletion = vi.hoisted(() => ({ runAccountDeletion: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../deletion-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../deletion-service')>()),
  runAccountDeletion: deletion.runAccountDeletion,
}));

// The real deleter (`deletion-service.ts:96`) calls `redis.del`; the last test here runs it for
// real, so the connection needs the same stub its own test file gives it.
const redisMock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), del: vi.fn(), status: 'ready' }));
vi.mock('../../../../config/redis', () => ({ default: redisMock }));

import { setupMongo, teardownMongo, clearCollections } from '../../../../__tests__/helpers/mongoMemory';
import { ELIGIBLE_STATUSES, JuviAccount } from '../../../../models/juvi/JuviAccount';
import { User } from '../../../../models/User';
import { Person } from '../../../../models/people/Person';
import { sweepAccountDeletions } from '../deletion-sweep-worker';
import { DELETION_GRACE_DAYS } from '../deletion-service';

/**
 * The sweep, from the two directions it can be wrong.
 *
 * **T12 — the query shapes.** Two one-line "improvements" a reader would plausibly make, and neither
 * would fail any other test in the suite: a `status` predicate looks like tidiness, and a
 * `deletionClaimedAt` predicate looks like the same double-processing guard the claim already gives.
 * They are not equivalent, and the difference is a person's account either surviving forever or
 * being destroyed after they cancelled. Hence a test each, and hence a mutation run rather than a
 * reading.
 *
 * **T4 — the AC3 guard.** The sweep is one of the two paths into the real deleter, so it is also
 * where "the person's ERP login survives" has to be re-proved rather than assumed from the in-app
 * test. That one runs the real deleter instead of the spy, and needs the Redis stub above.
 */

const NOW = new Date('2026-11-10T04:00:00.000Z');
const PAST_DEADLINE = new Date(NOW.getTime() - (DELETION_GRACE_DAYS + 1) * 86_400_000);
const oid = () => new Types.ObjectId();

beforeAll(async () => { await setupMongo(); });
beforeEach(() => {
  // `mockReset` *and* the default, not `mockClear`: `afterEach`'s `restoreAllMocks` drops the
  // implementation, so a later test would otherwise inherit whichever one the previous test set.
  deletion.runAccountDeletion.mockReset();
  deletion.runAccountDeletion.mockResolvedValue(undefined);
});
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); vi.restoreAllMocks(); });

describe('the sweep\'s query shapes (011 T12)', () => {
  it('hands an `exiting` account whose request is past its deadline to the deleter', async () => {
    // `exiting` is a real state a person can be in — they told the college they are leaving — and it
    // is deliberately absent from ELIGIBLE_STATUSES, which gates *notification* fan-out, not this.
    const status = 'exiting' as const;
    expect(ELIGIBLE_STATUSES).not.toContain(status as never);

    const collegeId = oid();
    const userId = oid();
    const account = await JuviAccount.create({
      collegeId, personId: oid(), userId, kind: 'student', provisionedBy: 'test', status,
      deletionRequestedAt: PAST_DEADLINE, deletionRequestedVia: 'public_web',
    });

    const result = await sweepAccountDeletions(NOW);

    // A `status: { $in: ELIGIBLE_STATUSES }` predicate on the scan or the claim leaves this row
    // scheduled for deletion forever, which is the exact outcome the request asked to avoid.
    expect(deletion.runAccountDeletion).toHaveBeenCalledTimes(1);
    expect(String(deletion.runAccountDeletion.mock.calls[0]![0]._id)).toBe(String(account._id));
    expect(result.deleted).toBe(1);
    // The sweep claims and hands over; `runAccountDeletion` is what removes the row (and is tested
    // for real in `deletion-service.test.ts`).
    expect((await JuviAccount.findById(account._id))!.deletionClaimedAt).toBeInstanceOf(Date);
  });

  it('leaves accounts that never asked alone, and those still inside their window', async () => {
    // The deadline is *behind* now, never ahead of it: a sign error here — or a grace period read
    // from the wrong side — sweeps everyone who is merely still inside their seven days, which is
    // the only thing standing between a password-stuffing attacker and an irreversible deletion.
    // (The never-requested row is the second half of the same property: the scan is a deadline, not
    // a match-everything.)
    const collegeId = oid();
    const never = await JuviAccount.create({
      collegeId, personId: oid(), userId: oid(), kind: 'student', provisionedBy: 'test',
    });
    const withinGrace = await JuviAccount.create({
      collegeId, personId: oid(), userId: oid(), kind: 'student', provisionedBy: 'test',
      deletionRequestedAt: new Date(NOW.getTime() - 86_400_000), deletionRequestedVia: 'public_web',
    });

    const result = await sweepAccountDeletions(NOW);

    expect(deletion.runAccountDeletion).not.toHaveBeenCalled();
    expect(result.deleted).toBe(0);
    expect(await JuviAccount.countDocuments({ collegeId })).toBe(2);
    expect((await JuviAccount.findById(withinGrace._id))!.deletionRequestedAt).toBeInstanceOf(Date);
    expect((await JuviAccount.findById(never._id))!.deletionClaimedAt ?? null).toBeNull();
  });

  it('does not delete a row whose request is cleared between the scan and the claim', async () => {
    const collegeId = oid();
    const userId = oid();
    const account = await JuviAccount.create({
      collegeId, personId: oid(), userId, kind: 'student', provisionedBy: 'test',
      deletionRequestedAt: PAST_DEADLINE, deletionRequestedVia: 'public_web',
    });

    // The scan sees a due row, and the cancellation lands in the gap before the claim — the window
    // the claim's conditional filter exists to close. Reproduced by making the scan perform the
    // cancellation as it resolves, which is deterministic where a real race is not.
    //
    // Only the *scan* is faked (recognised by its filter), so anything else the sweep reaches for
    // still runs for real. And the deleter is a spy, so "did not delete" is asserted as "was never
    // asked to" rather than inferred from the row surviving — which an exception would also explain,
    // since the sweep swallows per-row failures.
    const realFind = JuviAccount.find.bind(JuviAccount);
    vi.spyOn(JuviAccount, 'find').mockImplementation(((filter: Record<string, unknown>, ...rest: unknown[]) => {
      if (!('deletionRequestedAt' in filter)) return (realFind as (...a: unknown[]) => unknown)(filter, ...rest);
      const chain = {
        limit: () => chain,
        lean: async () => {
          await JuviAccount.updateOne({ _id: account._id }, { $unset: { deletionRequestedAt: 1, deletionRequestedVia: 1 } });
          return [{ _id: account._id }];
        },
      };
      return chain;
    }) as never);

    const result = await sweepAccountDeletions(NOW);

    // Without `deletionRequestedAt: { $lte: deadline, $ne: null }` on the claim — or with the claim
    // reduced to `{ _id }` — this account is destroyed moments after its owner cancelled.
    expect(deletion.runAccountDeletion).not.toHaveBeenCalled();
    expect(result.deleted).toBe(0);
    expect(await JuviAccount.findById(account._id)).not.toBeNull();
  });
});

describe('the sweep\'s AC3 guard (011 T4, both paths)', () => {
  it('leaves the person\'s ERP login intact when the sweep is what runs the deletion', async () => {
    // The AC3 guard — the person's web login must survive their Juvi account being deleted — is the
    // one worst failure mode in this feature, and 011 requires it to hold on **both** paths into
    // `runAccountDeletion`: the in-app call and this sweep. The sibling `deletion-service.test.ts`
    // proves it for the in-app call; this proves it for the sweep.
    //
    // It has to run the *real* deleter to do that. The tests above are happy with the spy — they ask
    // whether the sweep reached the deleter, which the spy answers — but "was handed over" is not
    // "was handed over safely", and the spy would report a deleter that destroyed the login exactly
    // as it reports a correct one.
    const actual = await vi.importActual<typeof import('../deletion-service')>('../deletion-service');
    deletion.runAccountDeletion.mockImplementation(actual.runAccountDeletion as never);

    const collegeId = oid();
    const personId = oid();
    const user = await new User({
      email: 'swept@x.test', password: 'plain-secret', name: 'swept', role: 'student', personaType: 'L-STU',
    }).save();
    await Person.create({ _id: personId, collegeId, name: 'Person swept', phone: '1' });
    const account = await JuviAccount.create({
      collegeId, personId, userId: user._id, kind: 'student', provisionedBy: 'test',
      deletionRequestedAt: PAST_DEADLINE, deletionRequestedVia: 'public_web',
    });
    const hashBefore = user.password;

    const result = await sweepAccountDeletions(NOW);

    // The real deleter ran, so the account row going is a deletion and not the sweep skipping it.
    expect(result.deleted).toBe(1);
    expect(await JuviAccount.findById(account._id)).toBeNull();

    // `not.toBeNull()`, not `toBeDefined()`: a deleted user comes back as `null`, and `null` is
    // defined. Written the weaker way this assertion would pass on precisely the failure it exists
    // to catch — an account whose owner no longer exists anywhere.
    const after = await User.findById(user._id).lean();
    expect(after).not.toBeNull();
    expect(after!.isActive).toBe(true);
    expect(after!.password).toBe(hashBefore);
  });
});
