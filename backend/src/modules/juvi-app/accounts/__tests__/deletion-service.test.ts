import { describe, it, expect, vi } from 'vitest';
import { deleteScoped } from '../deletion-service';

/**
 * 011-account-deletion T3 — the tenancy guard on the module's deleteMany path.
 *
 * The scope-plugin hooks findOne/updateOne/deleteOne/… but NOT deleteMany, and it is
 * inert on the mobile stack. Nothing else scopes these writes, so `deleteScoped` is
 * the only thing standing between a bug and a cross-college delete.
 */

describe('deleteScoped', () => {
  it('throws without a collegeId and does not touch the model', async () => {
    const model = { deleteMany: vi.fn() } as any;
    await expect(deleteScoped(model, { accountId: 'a1' })).rejects.toThrow(/collegeId/);
    expect(model.deleteMany).not.toHaveBeenCalled();
  });

  it('passes the filter through untouched when collegeId is present', async () => {
    const model = { deleteMany: vi.fn().mockResolvedValue({ deletedCount: 2 }) } as any;
    const res = await deleteScoped(model, { collegeId: 'c1', accountId: 'a1' });
    expect(model.deleteMany).toHaveBeenCalledWith({ collegeId: 'c1', accountId: 'a1' });
    expect(res.deletedCount).toBe(2);
  });
});
